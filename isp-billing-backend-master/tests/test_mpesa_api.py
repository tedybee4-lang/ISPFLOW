"""Tests for the current treasury-owned M-PESA boundary."""

from httpx import AsyncClient


async def test_legacy_mpesa_route_fails_closed_without_gateway(
    client: AsyncClient, auth_headers: dict
):
    response = await client.post(
        "/api/v1/mpesa/initiate-payment",
        headers=auth_headers,
        json={
            "amount": 100,
            "account_reference": "LOCAL-001",
            "description": "Test",
        },
    )

    assert response.status_code == 503
    assert "not configured" in response.json()["error"]["message"].lower()


async def test_stk_endpoint_reports_retired_gateway_without_charging(
    client: AsyncClient, auth_headers: dict
):
    response = await client.post(
        "/api/v1/billing/payments/mpesa/stk",
        headers=auth_headers,
        json={
            "phone_number": "254712345678",
            "amount": 100,
            "invoice_number": "LOCAL-TEST-INVOICE",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["error"]


async def test_stk_endpoint_validates_request_before_processing(
    client: AsyncClient, auth_headers: dict
):
    response = await client.post(
        "/api/v1/billing/payments/mpesa/stk",
        headers=auth_headers,
        json={"phone_number": "not-a-phone", "amount": 0},
    )

    assert response.status_code == 422


async def test_callback_reports_disabled_processing_instead_of_success(
    client: AsyncClient,
):
    response = await client.post(
        "/api/v1/billing/payments/mpesa/callback",
        json={"Body": {"stkCallback": {"ResultCode": 0}}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["message"]
    assert body["error"]
