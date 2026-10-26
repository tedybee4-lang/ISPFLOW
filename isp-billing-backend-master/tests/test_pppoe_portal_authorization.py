from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.portal.pppoe import (
    RenewalRequest,
    _require_customer_access,
    get_dashboard,
    renew_subscription,
    verify_pppoe_payment,
)
from app.models.user import UserRole


def test_customer_can_access_only_own_portal_records():
    organization = SimpleNamespace(id=12)
    customer = SimpleNamespace(id=34, organization_id=12, role=UserRole.CUSTOMER)

    _require_customer_access(customer, organization, requested_user_id=34)


@pytest.mark.parametrize(
    ("customer", "organization", "requested_user_id"),
    [
        (SimpleNamespace(id=34, organization_id=12, role=UserRole.CUSTOMER), SimpleNamespace(id=99), 34),
        (SimpleNamespace(id=34, organization_id=12, role=UserRole.CUSTOMER), SimpleNamespace(id=12), 35),
        (SimpleNamespace(id=34, organization_id=12, role=UserRole.ISP_ADMIN), SimpleNamespace(id=12), 34),
    ],
)
def test_portal_rejects_other_tenants_users_and_non_customer_roles(
    customer, organization, requested_user_id
):
    with pytest.raises(HTTPException) as exc:
        _require_customer_access(customer, organization, requested_user_id)

    assert exc.value.status_code == 403


class UnexpectedDatabaseAccess:
    async def execute(self, *_args, **_kwargs):
        pytest.fail("Unauthorized portal requests must be rejected before database access")


@pytest.mark.asyncio
async def test_dashboard_route_rejects_another_customers_user_id():
    customer = SimpleNamespace(id=34, organization_id=12, role=UserRole.CUSTOMER)

    with pytest.raises(HTTPException) as exc:
        await get_dashboard(
            "isp",
            db=UnexpectedDatabaseAccess(),
            organization=SimpleNamespace(id=12),
            user_id=35,
            current_user=customer,
        )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_renewal_route_rejects_another_customers_user_id():
    customer = SimpleNamespace(id=34, organization_id=12, role=UserRole.CUSTOMER)

    with pytest.raises(HTTPException) as exc:
        await renew_subscription(
            "isp",
            RenewalRequest(plan_id=5, phone_number="0712345678"),
            SimpleNamespace(headers={}),
            db=UnexpectedDatabaseAccess(),
            organization=SimpleNamespace(id=12),
            user_id=35,
            current_user=customer,
        )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_payment_verification_rejects_a_different_organization():
    customer = SimpleNamespace(id=34, organization_id=12, role=UserRole.CUSTOMER)

    with pytest.raises(HTTPException) as exc:
        await verify_pppoe_payment(
            "other-isp",
            reference="PPP-REFERENCE",
            db=UnexpectedDatabaseAccess(),
            organization=SimpleNamespace(id=99),
            current_user=customer,
        )

    assert exc.value.status_code == 403
