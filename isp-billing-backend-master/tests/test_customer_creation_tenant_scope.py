from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.users.customers import CustomerCreate, create_customer_user
from app.models.user import User, UserRole, UserStatus


class _Result:
    @staticmethod
    def scalar_one_or_none():
        return None


class _FakeSession:
    def __init__(self):
        self.added = None

    async def execute(self, _query):
        return _Result()

    def add(self, model):
        self.added = model

    async def commit(self):
        return None

    async def refresh(self, model):
        model.id = 84
        model.created_at = datetime.utcnow()
        model.updated_at = model.created_at
        model.last_login = None
        model.avatar_url = None
        model.phone_verified_at = None


def _customer_data():
    return CustomerCreate(
        username="localcustomer",
        email="localcustomer@example.com",
        password="StrongLocalPass123",
        first_name="Local",
        last_name="Customer",
    )


@pytest.mark.asyncio
async def test_customer_creation_rejects_cross_tenant_scope():
    actor = SimpleNamespace(role=UserRole.ISP_ADMIN, organization_id=10)

    with pytest.raises(HTTPException) as error:
        await create_customer_user(
            _customer_data(),
            org_id=20,
            current_user=actor,
            db=object(),
        )

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_customer_creation_sets_customer_role_and_never_returns_password():
    actor = SimpleNamespace(role=UserRole.ISP_ADMIN, organization_id=10)
    db = _FakeSession()

    result = await create_customer_user(
        _customer_data(),
        org_id=10,
        current_user=actor,
        db=db,
    )

    assert result.id == 84
    assert result.role == UserRole.CUSTOMER
    assert result.status == UserStatus.PENDING_VERIFICATION
    assert result.is_verified is False
    assert db.added.organization_id == 10
    assert db.added.hashed_password != "StrongLocalPass123"
    assert "hashed_password" not in result.model_dump()
    assert "password" not in result.model_dump()
