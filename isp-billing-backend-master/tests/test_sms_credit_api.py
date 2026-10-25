"""Tests for retired SMS credit routes and protected router diagnostics."""

from httpx import AsyncClient


async def test_retired_sms_credit_route_is_not_registered(client: AsyncClient):
    response = await client.get("/api/v1/sms-credit/accounts")

    assert response.status_code == 404


async def test_router_connection_route_requires_authentication(client: AsyncClient):
    response = await client.get("/api/v1/routers/999999/active-connections")

    assert response.status_code == 401


async def test_missing_router_connections_are_not_disclosed(
    client: AsyncClient, admin_auth_headers: dict
):
    response = await client.get(
        "/api/v1/routers/999999/active-connections", headers=admin_auth_headers
    )

    assert response.status_code == 404
