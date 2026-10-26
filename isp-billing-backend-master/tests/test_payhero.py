"""PayHero tenant isolation, channel lifecycle, and callback tests."""

from decimal import Decimal

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import get_password_hash
from app.models.organization import Organization, OrganizationType
from app.models.billing import Payment
from app.models.payment_gateway import PaymentTransaction, TenantPaymentChannel
from app.models.user import User, UserRole, UserStatus


class FakePayHeroClient:
    def __init__(self):
        self.channels = []
        self.register_calls = 0
        self.initiate_calls = 0
        self.account_id = None
        self.fail_after_create = False
        self.transaction_status = {
            "status": "SUCCESS",
            "success": True,
            "reference": "provider-ref",
        }

    async def list_payment_channels(self, page=None):
        return {
            "payment_channels": list(self.channels),
            "pagination": {"next_page": None},
        }

    async def register_payment_channel(self, **payload):
        self.register_calls += 1
        channel = {
            "id": 900 + self.register_calls,
            "account_id": self.account_id,
            "channel_type": payload["channel_type"],
            "short_code": payload["short_code"],
            "account_number": payload["account_number"],
            "is_active": True,
        }
        self.channels.append(channel)
        if self.fail_after_create:
            self.fail_after_create = False
            raise httpx.ConnectTimeout("simulated response loss")
        return channel

    async def initiate_stk_push(self, **kwargs):
        self.initiate_calls += 1
        return {
            "success": True,
            "status": "QUEUED",
            "reference": "provider-ref",
            "CheckoutRequestID": "checkout-1",
        }

    async def get_transaction_status(self, reference):
        assert reference == "provider-ref"
        return dict(self.transaction_status)


@pytest.fixture
def fake_payhero(monkeypatch):
    fake = FakePayHeroClient()
    import app.api.v1.payments.payhero as routes

    def create_client(**kwargs):
        fake.account_id = kwargs.get("account_id")
        return fake

    monkeypatch.setattr(routes, "PayHeroClient", create_client)
    return fake


def channel_payload(**overrides):
    return {
        "channel_type": "till",
        "short_code": "123456",
        "account_number": "merchant-account-1",
        "description": "Test till",
        "account_id": 12345,
        "api_token": "sandbox-token",
        **overrides,
    }


async def create_channel(client: AsyncClient, headers, **overrides):
    response = await client.post(
        "/api/v1/payhero/channels",
        json=channel_payload(**overrides),
        headers=headers,
    )
    return response


@pytest.mark.asyncio
async def test_channel_id_is_generated_and_not_returned(
    client: AsyncClient, admin_auth_headers, fake_payhero, db_session
):
    response = await create_channel(client, admin_auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "active"
    assert data["is_verified"] is True
    assert "payhero_channel_id" not in data
    assert "api_token" not in data
    assert "sandbox-token" not in response.text
    assert fake_payhero.register_calls == 1
    channel_result = await db_session.execute(select(TenantPaymentChannel))
    channel = channel_result.scalar_one()
    assert channel.payhero_channel_id == 901

    local = await client.get(
        "/api/v1/payhero/channels/local",
        headers=admin_auth_headers,
    )
    assert local.status_code == 200
    assert "payhero_channel_id" not in local.text
    assert "sandbox-token" not in local.text


@pytest.mark.asyncio
async def test_retry_after_response_loss_reuses_provider_channel(
    client: AsyncClient, admin_auth_headers, fake_payhero
):
    fake_payhero.fail_after_create = True
    failed = await create_channel(client, admin_auth_headers)
    assert failed.status_code == 502
    assert fake_payhero.register_calls == 1

    retried = await create_channel(client, admin_auth_headers)
    assert retried.status_code == 200, retried.text
    assert retried.json()["status"] == "active"
    assert fake_payhero.register_calls == 1


@pytest.mark.asyncio
async def test_missing_credentials_are_clear_and_never_returned(
    client: AsyncClient, admin_auth_headers
):
    response = await create_channel(
        client,
        admin_auth_headers,
        api_token="",
    )
    assert response.status_code == 422
    assert "credentials" in response.text.lower()
    assert "sandbox-token" not in response.text


def test_generated_channel_identifier_is_internal():
    from app.api.v1.payments.payhero import _channel_status_payload, _set_channel_result

    channel = TenantPaymentChannel(
        organization_id=1,
        channel_type="till",
        short_code="123456",
        account_number="merchant-account-1",
        status="channel_creation_pending",
        is_active=False,
        is_verified=False,
    )

    assert _set_channel_result(
        channel,
        {"id": 901, "is_active": True},
    ) is True
    assert channel.payhero_channel_id == 901
    payload = _channel_status_payload(channel)
    assert payload["status"] == "active"
    assert "payhero_channel_id" not in payload


@pytest.mark.asyncio
async def test_cross_tenant_channels_and_status_are_not_visible(
    client: AsyncClient,
    admin_auth_headers,
    test_organization,
    test_admin_user,
    db_session,
    fake_payhero,
):
    channel_response = await create_channel(client, admin_auth_headers)
    assert channel_response.status_code == 200, channel_response.text
    channel_result = await db_session.execute(
        select(TenantPaymentChannel).where(
            TenantPaymentChannel.organization_id == test_organization.id
        )
    )
    channel = channel_result.scalar_one()
    db_session.add(
        PaymentTransaction(
            organization_id=test_organization.id,
            tenant_payment_channel_id=channel.id,
            transaction_reference="PH-private-reference",
            amount=Decimal("100"),
            currency="KES",
            transaction_type="payment",
            status="pending",
            user_id=test_admin_user.id,
        )
    )
    await db_session.commit()

    other_org = Organization(
        name="Other ISP",
        slug="other-isp",
        email="other@example.com",
        organization_type=OrganizationType.HYBRID,
    )
    db_session.add(other_org)
    await db_session.flush()
    other_admin = User(
        username="other-admin",
        email="other-admin@example.com",
        organization_id=other_org.id,
        first_name="Other",
        last_name="Admin",
        hashed_password=get_password_hash("otherpassword"),
        role=UserRole.ISP_ADMIN,
        status=UserStatus.ACTIVE,
        is_verified=True,
        is_active=True,
    )
    db_session.add(other_admin)
    await db_session.commit()

    login = await client.post(
        "/api/v1/auth/login",
        data={"username": other_admin.username, "password": "otherpassword"},
    )
    assert login.status_code == 200
    token = login.json()["data"]["access_token"]
    other_headers = {"Authorization": f"Bearer {token}"}

    local = await client.get("/api/v1/payhero/channels/local", headers=other_headers)
    assert local.status_code == 200
    assert local.json() == []

    status = await client.get(
        "/api/v1/payhero/status/PH-private-reference",
        headers=other_headers,
    )
    assert status.status_code == 404
    initiation = await client.post(
        "/api/v1/payhero/initiate",
        json={"amount": 100, "phone_number": "0712345678"},
        headers=other_headers,
    )
    assert initiation.status_code == 409
    callback = await client.post(
        "/api/v1/payhero/callback",
        json={"response": {"ExternalReference": "PH-other-tenant-reference"}},
    )
    assert callback.status_code == 404
    assert fake_payhero.register_calls == 1
    assert fake_payhero.initiate_calls == 0


@pytest.mark.asyncio
async def test_unverified_callback_does_not_record_or_activate_payment(
    client: AsyncClient,
    admin_auth_headers,
    test_admin_user,
    test_organization,
    db_session,
    fake_payhero,
):
    response = await create_channel(client, admin_auth_headers)
    assert response.status_code == 200, response.text
    channel_result = await db_session.execute(
        select(TenantPaymentChannel).where(
            TenantPaymentChannel.organization_id == test_organization.id
        )
    )
    channel = channel_result.scalar_one()
    transaction = PaymentTransaction(
        organization_id=test_organization.id,
        tenant_payment_channel_id=channel.id,
        transaction_reference="PH-test-unverified",
        amount=Decimal("100"),
        currency="KES",
        transaction_type="payment",
        status="pending",
        phone_number="0712345678",
        user_id=test_admin_user.id,
        extra_data={
            "payhero_reference": "provider-ref",
            "checkout_request_id": "checkout-1",
        },
    )
    db_session.add(transaction)
    await db_session.commit()
    fake_payhero.transaction_status = {
        "status": "QUEUED",
        "success": False,
        "reference": "provider-ref",
    }

    callback = await client.post(
        "/api/v1/payhero/callback",
        json={
            "status": True,
            "response": {
                "ExternalReference": "PH-test-unverified",
                "CheckoutRequestID": "checkout-1",
                "ResultCode": 0,
                "Status": "Success",
                "Amount": 100,
                "Phone": "+254712345678",
                "MpesaReceiptNumber": "TEST123",
            },
        },
    )
    assert callback.status_code == 409
    await db_session.refresh(transaction)
    assert transaction.status == "pending"
    payments = await db_session.execute(
        select(Payment).where(Payment.transaction_id == transaction.transaction_reference)
    )
    assert payments.scalars().all() == []


@pytest.mark.asyncio
async def test_duplicate_verified_callbacks_create_one_payment(
    client: AsyncClient,
    admin_auth_headers,
    test_admin_user,
    test_organization,
    db_session,
    fake_payhero,
):
    response = await create_channel(client, admin_auth_headers)
    assert response.status_code == 200, response.text
    channel_result = await db_session.execute(
        select(TenantPaymentChannel).where(
            TenantPaymentChannel.organization_id == test_organization.id
        )
    )
    channel = channel_result.scalar_one()
    transaction = PaymentTransaction(
        organization_id=test_organization.id,
        tenant_payment_channel_id=channel.id,
        transaction_reference="PH-test-duplicate",
        amount=Decimal("100"),
        currency="KES",
        transaction_type="payment",
        status="pending",
        phone_number="0712345678",
        user_id=test_admin_user.id,
        extra_data={
            "payhero_reference": "provider-ref",
            "checkout_request_id": "checkout-1",
        },
    )
    db_session.add(transaction)
    await db_session.commit()
    callback_body = {
        "status": True,
        "response": {
            "ExternalReference": "PH-test-duplicate",
            "CheckoutRequestID": "checkout-1",
            "ResultCode": 0,
            "Status": "Success",
            "Amount": 100,
            "Phone": "+254712345678",
            "MpesaReceiptNumber": "TEST456",
        },
    }

    first = await client.post("/api/v1/payhero/callback", json=callback_body)
    second = await client.post("/api/v1/payhero/callback", json=callback_body)
    assert first.status_code == 200, first.text
    assert second.status_code == 200
    assert second.json()["status"] == "already_processed"
    payments = await db_session.execute(
        select(Payment).where(Payment.transaction_id == transaction.transaction_reference)
    )
    assert len(payments.scalars().all()) == 1
