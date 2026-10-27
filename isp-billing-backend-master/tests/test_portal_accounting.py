import pytest
from app.api.v1.portal import hotspot
from app.models.organization import Organization, OrganizationType
from app.models.plan import ServicePlan, PlanStatus
from app.models.customer_portal import VoucherCode, VoucherStatus
from app.models.billing import Payment
from app.models.subscription import Subscription
from app.models.user import User
from sqlalchemy import select, func


@pytest.mark.asyncio
async def test_voucher_redeem_updates_dashboard(db_session):
    org = Organization(name="ISP A", slug="isp-a", email="a@example.com", organization_type=OrganizationType.HYBRID)
    db_session.add(org)
    await db_session.flush()

    plan = ServicePlan(
        organization_id=org.id,
        name="Basic",
        status=PlanStatus.ACTIVE,
        plan_type="HOTSPOT",
        billing_cycle="MONTHLY",
        price=100,
        currency="KES",
        download_speed=5,
        upload_speed=2,
        data_limit=-1,
        validity_days=1,
    )
    db_session.add(plan)
    await db_session.flush()

    voucher = VoucherCode(
        organization_id=org.id,
        code="TEST-VOUCHER-1",
        plan_id=plan.id,
        status=VoucherStatus.ACTIVE,
        is_used=False,
    )
    db_session.add(voucher)
    await db_session.flush()

    req = type("Req", (), {"client": type("C", (), {"host": "127.0.0.1"})(), "headers": {}})()
    result = await hotspot.redeem_voucher(
        org_slug=org.slug,
        request=req,
        data=hotspot.VoucherRedeemRequest(code=voucher.code),
        db=db_session,
        organization=org,
    )
    assert result.success is True

    # voucher marked used
    await db_session.refresh(voucher)
    assert voucher.is_used is True
    assert voucher.status == VoucherStatus.USED

    # dashboard user created
    users = (await db_session.execute(select(User).where(User.organization_id == org.id))).scalars().all()
    assert len(users) >= 1

    # no payment created for voucher redeem
    payments = (await db_session.execute(select(Payment).where(Payment.organization_id == org.id))).scalars().all()
    assert len(payments) == 0


@pytest.mark.asyncio
async def test_voucher_redeem_test_portal_labelled(db_session):
    org = Organization(name="ISP B", slug="isp-b", email="b@example.com", organization_type=OrganizationType.HYBRID)
    db_session.add(org)
    await db_session.flush()

    plan = ServicePlan(
        organization_id=org.id,
        name="Basic",
        status=PlanStatus.ACTIVE,
        plan_type="HOTSPOT",
        billing_cycle="MONTHLY",
        price=100,
        currency="KES",
        download_speed=5,
        upload_speed=2,
        data_limit=-1,
        validity_days=1,
    )
    db_session.add(plan)
    await db_session.flush()

    voucher = VoucherCode(
        organization_id=org.id,
        code="TEST-VOUCHER-2",
        plan_id=plan.id,
        status=VoucherStatus.ACTIVE,
        is_used=False,
    )
    db_session.add(voucher)
    await db_session.flush()

    req = type("Req", (), {"client": type("C", (), {"host": "127.0.0.1"})(), "headers": {}})()
    result = await hotspot.redeem_voucher(
        org_slug=org.slug,
        request=req,
        data=hotspot.VoucherRedeemRequest(code=voucher.code, test_mode=True),
        db=db_session,
        organization=org,
    )
    assert result.success is True
    await db_session.refresh(voucher)
    assert voucher.is_test is True


@pytest.mark.asyncio
async def test_duplicate_voucher_redeem_not_double_counted(db_session):
    org = Organization(name="ISP C", slug="isp-c", email="c@example.com", organization_type=OrganizationType.HYBRID)
    db_session.add(org)
    await db_session.flush()

    plan = ServicePlan(
        organization_id=org.id,
        name="Basic",
        status=PlanStatus.ACTIVE,
        plan_type="HOTSPOT",
        billing_cycle="MONTHLY",
        price=100,
        currency="KES",
        download_speed=5,
        upload_speed=2,
        data_limit=-1,
        validity_days=1,
    )
    db_session.add(plan)
    await db_session.flush()

    voucher = VoucherCode(
        organization_id=org.id,
        code="TEST-VOUCHER-3",
        plan_id=plan.id,
        status=VoucherStatus.ACTIVE,
        is_used=False,
    )
    db_session.add(voucher)
    await db_session.flush()

    req = type("Req", (), {"client": type("C", (), {"host": "127.0.0.1"})(), "headers": {}})()
    r1 = await hotspot.redeem_voucher(
        org_slug=org.slug,
        request=req,
        data=hotspot.VoucherRedeemRequest(code=voucher.code),
        db=db_session,
        organization=org,
    )
    assert r1.success is True

    r2 = await hotspot.redeem_voucher(
        org_slug=org.slug,
        request=req,
        data=hotspot.VoucherRedeemRequest(code=voucher.code),
        db=db_session,
        organization=org,
    )
    assert r2.success is False


@pytest.mark.asyncio
async def test_tenant_isolation_voucher(db_session):
    org_a = Organization(name="ISP A2", slug="isp-a2", email="a2@example.com", organization_type=OrganizationType.HYBRID)
    org_b = Organization(name="ISP B2", slug="isp-b2", email="b2@example.com", organization_type=OrganizationType.HYBRID)
    db_session.add_all([org_a, org_b])
    await db_session.flush()

    plan_a = ServicePlan(
        organization_id=org_a.id,
        name="Basic",
        status=PlanStatus.ACTIVE,
        plan_type="HOTSPOT",
        billing_cycle="MONTHLY",
        price=100,
        currency="KES",
        download_speed=5,
        upload_speed=2,
        data_limit=-1,
        validity_days=1,
    )
    db_session.add(plan_a)
    await db_session.flush()

    voucher_a = VoucherCode(
        organization_id=org_a.id,
        code="VOUCHER-A",
        plan_id=plan_a.id,
        status=VoucherStatus.ACTIVE,
        is_used=False,
    )
    db_session.add(voucher_a)
    await db_session.flush()

    # Redeem through org B should fail (voucher not found in org B)
    req = type("Req", (), {"client": type("C", (), {"host": "127.0.0.1"})(), "headers": {}})()
    result = await hotspot.redeem_voucher(
        org_slug=org_b.slug,
        request=req,
        data=hotspot.VoucherRedeemRequest(code="VOUCHER-A"),
        db=db_session,
        organization=org_b,
    )
    assert result.success is False

    # org B has no users
    users_b = (await db_session.execute(select(User).where(User.organization_id == org_b.id))).scalars().all()
    assert len(users_b) == 0
