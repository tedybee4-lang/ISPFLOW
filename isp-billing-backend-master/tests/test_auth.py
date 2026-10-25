"""Test authentication endpoints."""

import re
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import onboarding
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.rbac import Role
from app.models.user import User, UserRole, UserStatus


class InMemoryRedis:
    def __init__(self):
        self.values = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, ex=None):
        self.values[key] = value

    async def delete(self, key):
        self.values.pop(key, None)


class TestAuthEndpoints:
    """Test authentication endpoints."""

    async def test_onboarding_registration_creates_organization_and_admin(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        monkeypatch,
    ):
        """Registration follows email verification and ISP onboarding."""
        email = f"signup-{uuid.uuid4().hex[:10]}@example.com"
        monkeypatch.setattr(onboarding.redis_client, "redis", InMemoryRedis())
        monkeypatch.setattr(settings, "debug", True)
        monkeypatch.setattr(settings, "environment", "development")
        monkeypatch.setattr(settings, "onboarding_expose_dev_codes", False)
        db_session.add(Role(name="admin", description="ISP administrator"))
        await db_session.flush()

        available = await client.post(
            "/api/v1/onboarding/check-email", json={"email": email}
        )
        assert available.status_code == 200
        assert available.json()["available"] is True

        sent = await client.post(
            "/api/v1/onboarding/send-verification", json={"email": email}
        )
        assert sent.status_code == 200
        code_match = re.search(r"\[DEV: (\d{6})\]", sent.json()["message"])
        assert code_match is not None

        verified = await client.post(
            "/api/v1/onboarding/verify-code",
            json={"email": email, "verification_code": code_match.group(1)},
        )
        assert verified.status_code == 200

        details = await client.post(
            "/api/v1/onboarding/business-details",
            json={
                "email": email,
                "business_name": "Test Onboarding ISP",
                "business_type": "hybrid",
                "phone": "+254712345678",
                "country": "Kenya",
                "city": "Nairobi",
            },
        )
        assert details.status_code == 200

        completed = await client.post(
            "/api/v1/onboarding/security-setup",
            json={
                "email": email,
                "admin_first_name": "Test",
                "admin_last_name": "Admin",
                "password": "StrongLocalTestPassword123!",
                "confirm_password": "StrongLocalTestPassword123!",
            },
        )
        assert completed.status_code == 200
        assert completed.json()["success"] is True
        assert completed.json()["organization_slug"] == "test-onboarding-isp"
        assert completed.json()["access_token"]

        unavailable = await client.post(
            "/api/v1/onboarding/check-email", json={"email": email}
        )
        assert unavailable.status_code == 200
        assert unavailable.json()["available"] is False

        result = await db_session.execute(select(User).where(User.email == email))
        created_user = result.scalar_one()
        assert created_user.role == UserRole.ISP_ADMIN
        assert created_user.organization_id == completed.json()["organization_id"]
        assert created_user.hashed_password != "StrongLocalTestPassword123!"

    async def test_local_registration_endpoint_is_retired(
        self, client: AsyncClient
    ):
        response = await client.post("/api/v1/auth/register", json={})
        assert response.status_code == 404

    async def test_onboarding_business_details_require_verified_email(
        self, client: AsyncClient
    ):
        response = await client.post(
            "/api/v1/onboarding/business-details",
            json={
                "email": "unverified@example.com",
                "business_name": "Unverified ISP",
                "business_type": "hybrid",
                "phone": "+254712345678",
            },
        )
        assert response.status_code == 400
        assert (
            "start the registration process"
            in response.json()["error"]["message"]
        )

    async def test_login_success(self, client: AsyncClient, test_user: User):
        """Test successful login."""
        login_data = {
            "username": test_user.username,
            "password": "testpassword"
        }
        
        response = await client.post("/api/v1/auth/login", data=login_data)
        
        assert response.status_code == 200
        data = response.json()["data"]
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_invalid_credentials(self, client: AsyncClient):
        """Test login with invalid credentials."""
        login_data = {
            "username": "nonexistent",
            "password": "wrongpassword"
        }
        
        response = await client.post("/api/v1/auth/login", data=login_data)
        
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["error"]["message"]

    async def test_login_inactive_user(self, client: AsyncClient, db_session: AsyncSession):
        """Test login with inactive user."""
        # Create inactive user
        inactive_user = User(
            username="inactive",
            email="inactive@example.com",
            first_name="Inactive",
            last_name="User",
            hashed_password=get_password_hash("testpassword"),
            role=UserRole.CUSTOMER,
            status=UserStatus.INACTIVE,
            is_active=False,
        )
        db_session.add(inactive_user)
        await db_session.commit()
        
        login_data = {
            "username": "inactive",
            "password": "testpassword"
        }
        
        response = await client.post("/api/v1/auth/login", data=login_data)
        
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["error"]["message"]

    async def test_get_current_user(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """Test getting current user info."""
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == test_user.id
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email

    async def test_get_current_user_unauthorized(self, client: AsyncClient):
        """Test getting current user without authentication."""
        response = await client.get("/api/v1/auth/me")
        
        assert response.status_code == 401

    async def test_refresh_token(self, client: AsyncClient, test_user: User):
        """Test token refresh."""
        # First login to get tokens
        login_data = {
            "username": test_user.username,
            "password": "testpassword"
        }
        
        login_response = await client.post("/api/v1/auth/login", data=login_data)
        assert login_response.status_code == 200
        
        refresh_token = login_response.json()["data"]["refresh_token"]
        
        # Refresh token
        refresh_data = {"refresh_token": refresh_token}
        response = await client.post("/api/v1/auth/refresh", json=refresh_data)
        
        assert response.status_code == 200
        data = response.json()["data"]
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_refresh_invalid_token(self, client: AsyncClient):
        """Test refresh with invalid token."""
        refresh_data = {"refresh_token": "invalid_token"}
        response = await client.post("/api/v1/auth/refresh", json=refresh_data)
        
        assert response.status_code == 401
        assert "Invalid refresh token" in response.json()["error"]["message"]

    async def test_logout(self, client: AsyncClient, auth_headers: dict):
        """Test user logout."""
        response = await client.post("/api/v1/auth/logout", headers=auth_headers)
        
        assert response.status_code == 200
        assert "Successfully logged out" in response.json()["message"]

    async def test_password_management_is_owned_by_sso(
        self, client: AsyncClient, auth_headers: dict
    ):
        response = await client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "testpassword", "new_password": "newpassword"},
            headers=auth_headers,
        )
        assert response.status_code == 404

        response = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "test@example.com"},
        )
        assert response.status_code == 404
