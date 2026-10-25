from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.api.v1.business import billing as billing_api
from app.api.v1.business.vouchers import (
    VoucherCreateRequest,
    generate_vouchers,
    router as vouchers_router,
)
from app.api.v1.network import routers as routers_api
from app.api.v1.portal import hotspot
from app.api.v1.platform.organizations import _platform_organization_scope
from app.models.billing import Invoice, InvoiceStatus, PaymentMethod
from app.models.customer_portal import VoucherStatus
from app.models.router import RouterLog
from app.models.router_command import RouterCommand
from app.schemas.router import Router as RouterResponse
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.modules.billing.service import BillingService
from app.modules.routers.service import RouterService
from app.core.exceptions import ValidationError


class FakeResult:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        if self.value is None:
            return []
        return self.value if isinstance(self.value, list) else [self.value]


class FakeDB:
    def __init__(self, values=None):
        self.values = values or {}
        self.statements = []
        self.added = []
        self.commits = 0
        self.deleted = []

    async def execute(self, statement):
        self.statements.append(statement)
        entity = statement.column_descriptions[0].get("entity")
        return FakeResult(self.values.get(entity))

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commits += 1

    async def refresh(self, value):
        return None

    async def rollback(self):
        return None

    async def delete(self, value):
        self.deleted.append(value)


def _compiled(statement):
    return statement.compile(compile_kwargs={"literal_binds": True})


def test_platform_organization_scope_includes_locally_onboarded_isp_members():
    query = select(Organization).where(_platform_organization_scope())
    sql = str(_compiled(query)).lower()

    assert "organizations.auth_tenant_id is not null" in sql
    assert "organizations.created_by is not null" in sql
    assert "users.organization_id = organizations.id" in sql


@pytest.mark.asyncio
async def test_manual_payment_rejects_invoice_not_owned_by_selected_user():
    db = FakeDB(
        {
            User: SimpleNamespace(id=11, organization_id=8),
            Invoice: SimpleNamespace(id=93, user_id=12, organization_id=8),
        }
    )
    service = BillingService(db, organization_id=8)

    with pytest.raises(ValidationError, match="selected user"):
        await service.create_payment(
            user_id=11,
            invoice_id=93,
            amount=Decimal("20.00"),
            payment_method=PaymentMethod.CASH,
            is_manual=True,
        )

    assert db.added == []
    assert db.commits == 0


@pytest.mark.asyncio
async def test_manual_payment_rejects_user_from_another_organization():
    db = FakeDB(
        {
            User: SimpleNamespace(id=11, organization_id=9),
            Invoice: SimpleNamespace(id=93, user_id=11, organization_id=9),
        }
    )
    service = BillingService(db, organization_id=8)

    with pytest.raises(ValidationError, match="organization"):
        await service.create_payment(
            user_id=11,
            invoice_id=93,
            amount=Decimal("20.00"),
            payment_method=PaymentMethod.CASH,
            is_manual=True,
        )

    assert db.added == []
    assert db.commits == 0


@pytest.mark.asyncio
async def test_manual_payment_rejects_invoice_from_another_organization():
    db = FakeDB(
        {
            User: SimpleNamespace(id=11, organization_id=8),
            Invoice: SimpleNamespace(id=93, user_id=11, organization_id=9),
        }
    )
    service = BillingService(db, organization_id=8)

    with pytest.raises(ValidationError, match="selected user and organization"):
        await service.create_payment(
            user_id=11,
            invoice_id=93,
            amount=Decimal("20.00"),
            payment_method=PaymentMethod.CASH,
            is_manual=True,
        )

    assert db.added == []
    assert db.commits == 0


@pytest.mark.asyncio
async def test_invoice_payment_and_item_lookups_include_tenant_boundary():
    db = FakeDB()
    service = BillingService(db, organization_id=8)

    assert await service.get_invoice_by_id(93) is None
    assert await service.get_payment_by_id(45) is None
    assert await service.update_invoice(93, {"notes": "changed"}) is None
    assert await service.update_invoice_status(93, InvoiceStatus.PAID) is None
    assert await service.update_invoice_item(17, {"description": "changed"}) is None

    invoice_sql = str(_compiled(db.statements[0]))
    payment_sql = str(_compiled(db.statements[1]))
    update_sql = str(_compiled(db.statements[2]))
    status_sql = str(_compiled(db.statements[3]))
    item_sql = str(_compiled(db.statements[4]))
    assert "invoices.organization_id = 8" in invoice_sql
    assert "payments.organization_id = 8" in payment_sql
    assert "invoices.organization_id = 8" in update_sql
    assert "invoices.organization_id = 8" in status_sql
    assert "JOIN invoices" in item_sql
    assert "invoices.organization_id = 8" in item_sql
    assert db.commits == 0


@pytest.mark.asyncio
async def test_billing_admin_role_values_preserve_tenant_admin_visibility(monkeypatch):
    calls = []

    class FakeBillingService:
        def __init__(self, _db, organization_id=None):
            self.organization_id = organization_id

        async def get_invoices(self, **kwargs):
            calls.append((self.organization_id, kwargs["user_id"]))
            return {"invoices": [], "total": 0, "page": 1, "size": 20, "pages": 0}

    monkeypatch.setattr(billing_api, "BillingService", FakeBillingService)
    common = {
        "pagination": SimpleNamespace(page=1, size=20, offset=0),
        "status": None,
        "search": None,
        "org_id": 8,
        "db": object(),
    }

    await billing_api.get_invoices(
        **common,
        user_id=None,
        current_user=SimpleNamespace(role=UserRole.ISP_ADMIN, id=10),
    )
    await billing_api.get_invoices(
        **common,
        user_id=None,
        current_user=SimpleNamespace(role=UserRole.PLATFORM_OWNER, id=1),
    )
    assert calls == [(8, None), (8, None)]

    with pytest.raises(HTTPException) as exc:
        await billing_api.get_invoices(
            **common,
            user_id=22,
            current_user=SimpleNamespace(role=UserRole.CUSTOMER, id=11),
        )
    assert exc.value.status_code == 403

    await billing_api.get_invoices(
        **common,
        user_id=None,
        current_user=SimpleNamespace(role=UserRole.CUSTOMER, id=11),
    )
    assert calls[-1] == (8, 11)


@pytest.mark.asyncio
async def test_router_child_lookup_is_scoped_through_parent_router():
    db = FakeDB()
    service = RouterService(db, organization_id=8)

    assert await service.get_router_device(55) is None
    query = str(_compiled(db.statements[0]))
    assert "JOIN routers" in query
    assert "routers.organization_id = 8" in query

    assert await service.get_router_logs(55) == []
    parent_query = str(_compiled(db.statements[1]))
    assert "routers.organization_id = 8" in parent_query
    assert await service.update_router_device(55, {"device_type": "hotspot"}) is None
    assert await service.delete_router_device(55) is False
    assert db.commits == 0
    assert db.deleted == []


@pytest.mark.asyncio
async def test_router_event_feed_omits_raw_log_and_command_details(monkeypatch):
    secret_marker = "sensitive-router-output"
    created_at = datetime.now(timezone.utc)
    db = FakeDB(
        {
            RouterLog: [
                SimpleNamespace(
                    id=1,
                    action="backup",
                    details=secret_marker,
                    error_message=secret_marker,
                    success=True,
                    created_at=created_at,
                )
            ],
            RouterCommand: [
                SimpleNamespace(
                    id=2,
                    action="backup",
                    result_message=secret_marker,
                    source=secret_marker,
                    status="success",
                    created_at=created_at,
                )
            ],
        }
    )

    class AuthorizedRouterService:
        def __init__(self, _db, organization_id=None):
            self.organization_id = organization_id

        async def get_by_id(self, router_id):
            if router_id == 9 and self.organization_id == 8:
                return SimpleNamespace(id=9, organization_id=8)
            return None

    monkeypatch.setattr(routers_api, "RouterService", AuthorizedRouterService)
    events = await routers_api.get_router_events(
        router_id=9,
        limit=100,
        current_user=SimpleNamespace(
            role=UserRole.ISP_ADMIN,
            organization_id=8,
        ),
        db=db,
    )

    assert len(events) == 2
    assert secret_marker not in str(events)
    assert all("details" not in event for event in events)


def test_router_response_schema_excludes_credentials_and_raw_configuration():
    assert not {"username", "password", "config"} & RouterResponse.model_fields.keys()


@pytest.mark.asyncio
async def test_platform_owner_router_list_uses_explicit_selected_organization(monkeypatch):
    captured = {}

    class ScopedRouterService:
        def __init__(self, db, organization_id):
            captured["organization_id"] = organization_id

        async def get_all(self, **kwargs):
            return {"items": [], "total": 0, "page": 1, "size": 10, "pages": 0}

    monkeypatch.setattr(routers_api, "RouterService", ScopedRouterService)
    result = await routers_api.get_routers(
        pagination=SimpleNamespace(offset=0, size=10, page=1),
        status=None,
        router_type=None,
        search=None,
        org_id=42,
        current_user=SimpleNamespace(role=UserRole.PLATFORM_OWNER, organization_id=None),
        db=FakeDB(),
    )

    assert captured["organization_id"] == 42
    assert result.items == []


@pytest.mark.asyncio
async def test_voucher_generation_requires_plan_from_current_organization():
    db = FakeDB()

    with pytest.raises(HTTPException) as exc:
        await generate_vouchers(
            data=VoucherCreateRequest(plan_id=22),
            org_id=8,
            db=db,
            current_user=SimpleNamespace(id=1),
        )

    assert exc.value.status_code == 404
    query = str(_compiled(db.statements[0]))
    assert "service_plans.organization_id = 8" in query


@pytest.mark.asyncio
async def test_voucher_management_routes_require_authorized_staff_role():
    endpoints = {
        "list_vouchers",
        "get_voucher_stats",
        "get_voucher",
        "generate_vouchers",
        "update_voucher",
        "delete_voucher",
    }
    checked = set()
    technician = SimpleNamespace(role=UserRole.ISP_TECHNICIAN)
    customer = SimpleNamespace(role=UserRole.CUSTOMER)

    for route in vouchers_router.routes:
        if route.name not in endpoints:
            continue
        user_dependency = next(
            dependency
            for dependency in route.dependant.dependencies
            if dependency.name == "current_user"
        )
        assert await user_dependency.call(current_user=technician) is technician
        with pytest.raises(HTTPException) as exc:
            await user_dependency.call(current_user=customer)
        assert exc.value.status_code == 403
        checked.add(route.name)

    assert checked == endpoints


@pytest.mark.asyncio
async def test_voucher_redemption_requires_plan_from_voucher_organization(monkeypatch):
    voucher = SimpleNamespace(
        id=7,
        code="TEST-CODE",
        status=VoucherStatus.ACTIVE,
        is_used=False,
        expires_at=None,
        plan_id=22,
    )
    db = FakeDB({hotspot.VoucherCode: voucher})

    async def no_rate_limit(*args, **kwargs):
        return None

    monkeypatch.setattr(hotspot, "limit_credential_attempt", no_rate_limit)
    result = await hotspot.redeem_voucher(
        org_slug="example",
        request=SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")),
        data=hotspot.VoucherRedeemRequest(code="TEST-CODE"),
        db=db,
        organization=SimpleNamespace(id=8),
    )

    assert result.success is False
    assert result.message == "Associated package not found"
    plan_query = str(_compiled(db.statements[1]))
    assert "service_plans.organization_id = 8" in plan_query
