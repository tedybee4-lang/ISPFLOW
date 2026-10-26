import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_reports_dashboard_no_500(client: AsyncClient, admin_auth_headers: dict):
    r = await client.get("/api/v1/reports/analytics/dashboard", headers=admin_auth_headers)
    print("DASHBOARD STATUS:", r.status_code)
    assert r.status_code in (200, 403)
    if r.status_code == 200:
        print("DASHBOARD OK")


@pytest.mark.asyncio
async def test_reports_charts_no_500(client: AsyncClient, admin_auth_headers: dict):
    r = await client.get("/api/v1/reports/analytics/dashboard-charts", headers=admin_auth_headers)
    print("CHARTS STATUS:", r.status_code)
    assert r.status_code in (200, 403)
    if r.status_code == 200:
        print("CHARTS OK")
