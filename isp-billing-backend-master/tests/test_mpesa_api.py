"""Tests for the retired M-PESA boundary."""

from httpx import AsyncClient


async def test_legacy_mpesa_route_is_removed(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/v1/mpesa/initiate-payment",
        headers=auth_headers,
        json={"amount": 100, "account_reference": "LOCAL-001", "description": "Test"},
    )
    assert response.status_code == 404


async def test_stk_endpoint_is_removed(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/v1/billing/payments/mpesa/stk",
        headers=auth_headers,
        json={"phone_number": "254712345678", "amount": 100, "invoice_number": "LOCAL-TEST-INVOICE"},
    )
    assert response.status_code == 404


async def test_stk_validation_route_is_removed(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/v1/billing/payments/mpesa/stk",
        headers=auth_headers,
        json={"phone_number": "not-a-phone", "amount": 0},
    )
    assert response.status_code == 404


async def test_callback_route_is_removed(client: AsyncClient):
    response = await client.post(
        "/api/v1/billing/payments/mpesa/callback",
        json={"Body": {"stkCallback": {"ResultCode": 0}}},
    )
    assert response.status_code == 404
