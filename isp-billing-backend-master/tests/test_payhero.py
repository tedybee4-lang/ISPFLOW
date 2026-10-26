"""PayHero payment gateway tests."""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient


class FakePayHeroClient:
    def __init__(self):
        self.register_calls = 0
        self.register_result = {"id": 999, "is_active": True}

    async def register_payment_channel(self, **kwargs):
        self.register_calls += 1
        return dict(self.register_result)

    async def list_payment_channels(self):
        return {"channels": []}

    async def initiate_stk_push(self, **kwargs):
        return {"success": True, "status": "QUEUED", "reference": "PHREF123", "CheckoutRequestID": "ws_CO_1"}

    async def get_transaction_status(self, reference):
        return {"status": "success"}


@pytest.fixture
def fake_payhero(monkeypatch):
    fake = FakePayHeroClient()
    import app.api.v1.payments.payhero as mod
    monkeypatch.setattr(mod, "PayHeroClient", lambda: fake)
    # also patch integration module used indirectly
    import app.integrations.payhero as integ
    monkeypatch.setattr(integ, "PayHeroClient", lambda: fake)
    return fake


@pytest.mark.asyncio
async def test_payhero_channel_auto_created(
    client: AsyncClient, admin_auth_headers, fake_payhero
):
    payload = {
        "channel_type": "till",
        "short_code": "123456",
        "account_number": "ACC1",
        "description": "My till",
    }
    resp = await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["payhero_channel_id"] == 999
    assert data["status"] == "active"
    assert data["is_verified"] is True
    assert fake_payhero.register_calls == 1


@pytest.mark.asyncio
async def test_payhero_channel_retry_no_duplicate(
    client: AsyncClient, admin_auth_headers, fake_payhero
):
    payload = {
        "channel_type": "till",
        "short_code": "777",
        "account_number": "ACC2",
        "description": "till",
    }
    r1 = await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    assert r1.status_code == 200
    # simulate failure then retry
    fake_payhero.register_result = {"id": None}
    r2 = await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    assert r2.status_code == 502
    # restore and retry
    fake_payhero.register_result = {"id": 1001, "is_active": True}
    r3 = await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    assert r3.status_code == 200
    assert r3.json()["payhero_channel_id"] == 1001
    # same record updated, not duplicated
    listing = await client.get("/api/v1/payhero/channels/local", headers=admin_auth_headers)
    assert listing.status_code == 200
    channels = listing.json()
    matches = [c for c in channels if c["short_code"] == "777"]
    assert len(matches) == 1


@pytest.mark.asyncio
async def test_payhero_missing_credentials_error(
    client: AsyncClient, admin_auth_headers, monkeypatch
):
    # Make PayHeroClient raise
    class BrokenClient:
        async def register_payment_channel(self, **kwargs):
            raise ValueError("PayHero API credentials are not configured")
        async def list_payment_channels(self):
            raise ValueError("PayHero API credentials are not configured")
    import app.api.v1.payments.payhero as mod
    monkeypatch.setattr(mod, "PayHeroClient", lambda: BrokenClient())
    payload = {"channel_type": "till", "short_code": "555", "account_number": "x", "description": "d"}
    resp = await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    assert resp.status_code == 502
    assert "credentials" in resp.text.lower() or "failed" in resp.text.lower()


@pytest.mark.asyncio
async def test_payhero_callback_idempotency(
    client: AsyncClient, admin_auth_headers, fake_payhero, db_session
):
    # Create a channel and transaction via initiate? Instead direct callback on unknown ref returns ignored
    body = {"response": {"ExternalReference": "NOPE", "ResultCode": 0, "Status": "Success", "Amount": 10}}
    resp = await client.post("/api/v1/payhero/callback", json=body)
    assert resp.status_code == 200
    assert resp.json().get("reason") == "unknown reference"


@pytest.mark.asyncio
async def test_payhero_cross_tenant_channel_not_visible(
    client: AsyncClient, admin_auth_headers, fake_payhero, db_session
):
    # second org
    from app.models.organization import Organization, OrganizationType
    org2 = Organization(name="Other ISP", slug="other-isp", email="o@example.com", organization_type=OrganizationType.HYBRID)
    db_session.add(org2)
    await db_session.flush()
    # admin stays org1; channel created under org1
    payload = {"channel_type": "till", "short_code": "999", "account_number": "x", "description": "d"}
    await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    listing = await client.get("/api/v1/payhero/channels/local", headers=admin_auth_headers)
    assert all(c["short_code"] != "LEAKED" for c in listing.json())
"""PayHero payment gateway tests."""

import pytest
from httpx import AsyncClient


class FakePayHeroClient:
    def __init__(self):
        self.register_calls = 0
        self.register_result = {"id": 999, "is_active": True}

    async def register_payment_channel(self, **kwargs):
        self.register_calls += 1
        return dict(self.register_result)

    async def list_payment_channels(self):
        return {"channels": []}

    async def initiate_stk_push(self, **kwargs):
        return {"success": True, "status": "QUEUED", "reference": "PHREF123", "CheckoutRequestID": "ws_CO_1"}

    async def get_transaction_status(self, reference):
        return {"status": "success"}


@pytest.fixture
def fake_payhero(monkeypatch):
    fake = FakePayHeroClient()
    import app.api.v1.payments.payhero as mod
    monkeypatch.setattr(mod, "PayHeroClient", lambda: fake)
    import app.integrations.payhero as integ
    monkeypatch.setattr(integ, "PayHeroClient", lambda: fake)
    return fake


@pytest.mark.asyncio
async def test_payhero_channel_auto_created(
    client: AsyncClient, admin_auth_headers, fake_payhero
):
    payload = {
        "channel_type": "till",
        "short_code": "123456",
        "account_number": "ACC1",
        "description": "My till",
    }
    resp = await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["payhero_channel_id"] == 999
    assert data["status"] == "active"
    assert data["is_verified"] is True
    assert fake_payhero.register_calls == 1


@pytest.mark.asyncio
async def test_payhero_channel_retry_no_duplicate(
    client: AsyncClient, admin_auth_headers, fake_payhero
):
    payload = {
        "channel_type": "till",
        "short_code": "777",
        "account_number": "ACC2",
        "description": "till",
    }
    r1 = await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    assert r1.status_code == 200
    fake_payhero.register_result = {"id": None}
    r2 = await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    assert r2.status_code == 502
    fake_payhero.register_result = {"id": 1001, "is_active": True}
    r3 = await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    assert r3.status_code == 200
    assert r3.json()["payhero_channel_id"] == 1001
    listing = await client.get("/api/v1/payhero/channels/local", headers=admin_auth_headers)
    assert listing.status_code == 200
    channels = listing.json()
    matches = [c for c in channels if c["short_code"] == "777"]
    assert len(matches) == 1


@pytest.mark.asyncio
async def test_payhero_missing_credentials_error(
    client: AsyncClient, admin_auth_headers, monkeypatch
):
    class BrokenClient:
        async def register_payment_channel(self, **kwargs):
            raise ValueError("PayHero API credentials are not configured")
        async def list_payment_channels(self):
            raise ValueError("PayHero API credentials are not configured")
    import app.api.v1.payments.payhero as mod
    monkeypatch.setattr(mod, "PayHeroClient", lambda: BrokenClient())
    payload = {"channel_type": "till", "short_code": "555", "account_number": "x", "description": "d"}
    resp = await client.post("/api/v1/payhero/channels", json=payload, headers=admin_auth_headers)
    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_payhero_callback_unknown_reference(client: AsyncClient):
    body = {"response": {"ExternalReference": "NOPE", "ResultCode": 0, "Status": "Success", "Amount": 10}}
    resp = await client.post("/api/v1/payhero/callback", json=body)
    assert resp.status_code == 200
    assert resp.json().get("reason") == "unknown reference"


@pytest.mark.asyncio
async def test_payhero_initiate_rejects_foreign_channel(
    client: AsyncClient, admin_auth_headers, fake_payhero, db_session
):
    # channel belongs to another org
    from app.models.organization import Organization, OrganizationType
    org2 = Organization(name="Other ISP", slug="other-isp", email="o@example.com", organization_type=OrganizationType.HYBRID)
    db_session.add(org2)
    await db_session.flush()
    from app.models.payment_gateway import TenantPaymentChannel
    ch = TenantPaymentChannel(
        organization_id=org2.id,
        channel_type="till",
        short_code="111",
        payhero_channel_id=555,
        is_active=True,
        is_verified=True,
        status="active",
    )
    db_session.add(ch)
    await db_session.commit()
    resp = await client.post(
        "/api/v1/payhero/initiate",
        json={"payhero_channel_id": 555, "amount": 100, "phone_number": "0700000000"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404
