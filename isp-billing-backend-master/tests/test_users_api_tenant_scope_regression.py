from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api import deps_org
from app.api.v1.users import users as users_api
from app.modules.auth.users import UserService
from app.models.user import UserRole, UserStatus
from app.schemas.user import AdminSetPassword, UserUpdate


def _actor(role: UserRole, organization_id: int | None = 10):
    return SimpleNamespace(role=role, organization_id=organization_id)


def _user(organization_id: int = 10):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=42,
        organization_id=organization_id,
        username="tenant-user",
        email="tenant@example.test",
        phone=None,
        first_name="Tenant",
        last_name="User",
        role=UserRole.ISP_TECHNICIAN,
        bio=None,
        is_verified=True,
        is_active=True,
        status=UserStatus.ACTIVE,
        avatar_url=None,
        created_at=now,
        updated_at=now,
        last_login=None,
        email_verified_at=None,
        phone_verified_at=None,
        hashed_password="old-hash",
    )


class _ScopedFakeService:
    target = _user(organization_id=20)
    scopes = []

    def __init__(self, _db):
        self.scopes = type(self).scopes

    async def get_by_id(self, user_id, organization_id=None):
        self.scopes.append((user_id, organization_id))
        if self.target.id == user_id and self.target.organization_id == organization_id:
            return self.target
        return None

    async def update_user(self, user_id, data, organization_id=None):
        return await self.get_by_id(user_id, organization_id)

    async def update_user_status(self, user_id, status, organization_id=None):
        return await self.get_by_id(user_id, organization_id)

    async def update_user_role(self, user_id, role, organization_id=None):
        return await self.get_by_id(user_id, organization_id)

    async def activate_user(self, user_id, organization_id=None):
        return await self.get_by_id(user_id, organization_id)

    async def deactivate_user(self, user_id, organization_id=None):
        return await self.get_by_id(user_id, organization_id)

    async def delete_user(self, user_id, organization_id=None):
        return bool(await self.get_by_id(user_id, organization_id))


@pytest.mark.asyncio
async def test_every_user_id_operation_is_scoped_to_authorized_organization(monkeypatch):
    _ScopedFakeService.scopes = []
    monkeypatch.setattr(users_api, "UserService", _ScopedFakeService)
    actor = _actor(UserRole.ISP_ADMIN, organization_id=10)
    db = object()

    def calls():
        yield users_api.get_user(42, org_id=10, current_user=actor, db=db)
        yield users_api.update_user(
            42, UserUpdate(first_name="Changed"), org_id=10, current_user=actor, db=db
        )
        yield users_api.update_user_status(
            42, UserStatus.INACTIVE, org_id=10, current_user=actor, db=db
        )
        yield users_api.update_user_role(
            42, UserRole.ISP_TECHNICIAN, org_id=10, current_user=actor, db=db
        )
        yield users_api.activate_user(42, org_id=10, current_user=actor, db=db)
        yield users_api.deactivate_user(42, org_id=10, current_user=actor, db=db)
        yield users_api.delete_user(42, org_id=10, current_user=actor, db=db)
        yield users_api.admin_set_password(
            42,
            AdminSetPassword(new_password="StrongPass123"),
            org_id=10,
            current_user=actor,
            db=db,
        )
        yield users_api.generate_api_token(42, org_id=10, current_user=actor, db=db)

    for request in calls():
        with pytest.raises(HTTPException) as error:
            await request
        assert error.value.status_code == 404

    assert _ScopedFakeService.scopes == [(42, 10)] * 9


@pytest.mark.asyncio
async def test_tenant_admin_cannot_assign_platform_owner(monkeypatch):
    _ScopedFakeService.scopes = []
    monkeypatch.setattr(users_api, "UserService", _ScopedFakeService)

    with pytest.raises(HTTPException) as error:
        await users_api.update_user_role(
            42,
            UserRole.PLATFORM_OWNER,
            org_id=10,
            current_user=_actor(UserRole.ISP_ADMIN, organization_id=10),
            db=object(),
        )

    assert error.value.status_code == 403
    assert _ScopedFakeService.scopes == []


@pytest.mark.asyncio
async def test_tenant_admin_can_update_user_in_same_organization(monkeypatch):
    tenant_user = _user(organization_id=10)

    class SameTenantService(_ScopedFakeService):
        target = tenant_user

        async def update_user(self, user_id, data, organization_id=None):
            user = await self.get_by_id(user_id, organization_id)
            if user:
                user.first_name = data.first_name
            return user

    SameTenantService.scopes = []
    monkeypatch.setattr(users_api, "UserService", SameTenantService)

    response = await users_api.update_user(
        42,
        UserUpdate(first_name="Updated"),
        org_id=10,
        current_user=_actor(UserRole.ISP_ADMIN, organization_id=10),
        db=object(),
    )

    assert response.first_name == "Updated"
    assert SameTenantService.scopes == [(42, 10)]


@pytest.mark.asyncio
async def test_platform_owner_may_promote_selected_tenant_user(monkeypatch):
    tenant_user = _user(organization_id=10)

    class SameTenantService(_ScopedFakeService):
        target = tenant_user

        async def update_user_role(self, user_id, role, organization_id=None):
            user = await self.get_by_id(user_id, organization_id)
            if user:
                user.role = role
                if role == UserRole.PLATFORM_OWNER:
                    user.organization_id = None
            return user

    SameTenantService.scopes = []
    monkeypatch.setattr(users_api, "UserService", SameTenantService)

    response = await users_api.update_user_role(
        42,
        UserRole.PLATFORM_OWNER,
        org_id=10,
        current_user=_actor(UserRole.PLATFORM_OWNER, organization_id=None),
        db=object(),
    )

    assert response.role == UserRole.PLATFORM_OWNER
    assert tenant_user.organization_id is None
    assert SameTenantService.scopes == [(42, 10)]


def test_generic_user_update_rejects_role_and_organization_changes():
    for field in ("role", "organization_id"):
        with pytest.raises(ValidationError):
            UserUpdate.model_validate({field: "platform_owner" if field == "role" else 99})


def test_platform_owner_requires_selected_organization_for_tenant_scope():
    owner = _actor(UserRole.PLATFORM_OWNER, organization_id=None)
    organization = SimpleNamespace(id=10)

    assert deps_org.get_org_id_for_query(owner, organization) == 10
    with pytest.raises(HTTPException) as error:
        deps_org.get_org_id_for_query(owner, None)
    assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_user_service_filters_id_lookup_and_clears_tenant_on_platform_promotion():
    tenant_user = _user(organization_id=10)

    class FakeResult:
        def scalar_one_or_none(self):
            return tenant_user

    class FakeDatabase:
        statement = None

        async def execute(self, statement):
            self.statement = statement
            return FakeResult()

        async def commit(self):
            pass

        async def refresh(self, _instance):
            pass

    db = FakeDatabase()
    service = UserService(db)
    updated = await service.update_user_role(
        tenant_user.id, UserRole.PLATFORM_OWNER, organization_id=10
    )

    assert updated is tenant_user
    assert tenant_user.role == UserRole.PLATFORM_OWNER
    assert tenant_user.organization_id is None
    assert "users.organization_id = :organization_id_1" in str(db.statement)
