from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.api.deps import _apply_authorized_tenant_scope, get_current_user
from app.api.v1.network import routers as router_api
from app.api.v1.network.routers import get_router_action_script
from app.api.v1.router_agent import _get_authorized_router, get_router_commands
from app.api.v1.support import reports
from app.core.security import (
    create_router_capability_token,
    verify_router_capability_token,
    verify_token,
)
from app.core.tenant_middleware import (
    TenantMiddleware,
    get_current_organization_id,
    set_current_organization_id,
)
from app.models.router import Router
from app.models.user import UserRole


def _request(path: str, tenant_id: str | None = None) -> Request:
    headers = []
    if tenant_id is not None:
        headers.append((b"x-tenant-id", tenant_id.encode("ascii")))
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": path,
            "headers": headers,
            "query_string": b"",
            "server": ("test", 80),
            "scheme": "http",
        }
    )


def test_router_agent_token_is_encrypted_at_rest():
    router = Router()
    router.agent_token_plain = "reusable-agent-token"

    assert router._agent_token_plain.startswith("enc:v1:")
    assert router.agent_token_plain == "reusable-agent-token"


def test_router_agent_token_supports_legacy_plaintext_during_migration():
    router = Router()
    router._agent_token_plain = "legacy-agent-token"

    assert router.agent_token_plain == "legacy-agent-token"


class _Result:
    def __init__(self, item=None, items=None, scalar=0):
        self.item = item
        self.items = items or []
        self.scalar_value = scalar

    def scalar_one_or_none(self):
        return self.item

    def scalar(self):
        return self.scalar_value

    def scalars(self):
        return self

    def all(self):
        return self.items


class _TenantDB:
    async def get(self, model, organization_id):
        return SimpleNamespace(id=organization_id)

    async def execute(self, statement):
        return _Result()


@pytest.fixture(autouse=True)
def _clear_tenant_scope():
    set_current_organization_id(None)
    yield
    set_current_organization_id(None)


@pytest.mark.asyncio
async def test_tenant_admin_cannot_select_another_tenant():
    user = SimpleNamespace(role=UserRole.ISP_ADMIN, organization_id=10)

    with pytest.raises(HTTPException) as error:
        await _apply_authorized_tenant_scope(
            _request("/api/v1/support/analytics/users", tenant_id="20"),
            user,
            _TenantDB(),
        )

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_tenant_admin_scope_comes_from_membership_not_header():
    user = SimpleNamespace(role=UserRole.ISP_ADMIN, organization_id=10)
    await _apply_authorized_tenant_scope(
        _request("/api/v1/support/analytics/users"),
        user,
        _TenantDB(),
    )

    assert get_current_organization_id() == 10


@pytest.mark.asyncio
async def test_platform_owner_can_select_an_existing_tenant():
    owner = SimpleNamespace(role=UserRole.PLATFORM_OWNER, organization_id=None)
    await _apply_authorized_tenant_scope(
        _request("/api/v1/support/analytics/users", tenant_id="20"),
        owner,
        _TenantDB(),
    )

    assert get_current_organization_id() == 20


@pytest.mark.asyncio
async def test_tenant_headers_do_not_scope_protected_requests_before_authentication():
    middleware = TenantMiddleware(app=lambda scope, receive, send: None)
    request = _request("/api/v1/support/analytics/users", tenant_id="20")

    assert await middleware._resolve_tenant(request) is None


@pytest.mark.asyncio
async def test_user_analytics_queries_are_scoped_to_authenticated_tenant():
    class QueryDB:
        def __init__(self):
            self.statements = []

        async def execute(self, statement):
            self.statements.append(str(statement))
            return _Result(scalar=3)

    user = SimpleNamespace(role=UserRole.ISP_ADMIN, organization_id=10)
    db = QueryDB()
    await _apply_authorized_tenant_scope(_request("/reports"), user, _TenantDB())

    await reports.get_user_analytics(
        start_date=None,
        end_date=None,
        current_user=user,
        db=db,
    )

    assert len(db.statements) == 3
    assert all("users.organization_id" in statement for statement in db.statements)


@pytest.mark.asyncio
async def test_subscription_csv_uses_authenticated_tenant_scope(monkeypatch):
    class ScopedReports:
        def __init__(self, db):
            assert get_current_organization_id() == 10

        async def generate_subscription_report_csv(self, **kwargs):
            return "organization_id\n10\n"

    monkeypatch.setattr(reports, "ReportsService", ScopedReports)
    user = SimpleNamespace(role=UserRole.ISP_ADMIN, organization_id=10)
    await _apply_authorized_tenant_scope(_request("/reports"), user, _TenantDB())

    response = await reports.export_subscriptions_csv(current_user=user, db=_TenantDB())

    assert response.body == b"organization_id\n10\n"


@pytest.mark.asyncio
async def test_tenant_admin_cannot_select_another_tenant_for_csv_export():
    user = SimpleNamespace(role=UserRole.ISP_ADMIN, organization_id=10)

    with pytest.raises(HTTPException) as error:
        await _apply_authorized_tenant_scope(
            _request("/reports", tenant_id="20"),
            user,
            _TenantDB(),
        )

    assert error.value.status_code == 403


class _RouterDB:
    def __init__(self, router, command=None):
        self.router = router
        self.command = command
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        rendered = str(statement)
        if "FROM routers" in rendered:
            params = statement.compile().params
            tenant = params.get("organization_id_1")
            return _Result(
                item=self.router
                if tenant is None or tenant == self.router.organization_id
                else None
            )
        return _Result(items=[self.command] if self.command is not None else [])


@pytest.mark.asyncio
async def test_router_operator_cannot_access_another_tenants_router():
    router = SimpleNamespace(id=5, organization_id=20)
    operator = SimpleNamespace(role=UserRole.ISP_ADMIN, organization_id=10)

    with pytest.raises(HTTPException) as error:
        await _get_authorized_router(5, operator, _RouterDB(router))

    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_router_operator_cannot_read_another_tenants_command_history():
    router = SimpleNamespace(id=5, organization_id=20)
    operator = SimpleNamespace(role=UserRole.ISP_ADMIN, organization_id=10)

    with pytest.raises(HTTPException) as error:
        await get_router_commands(
            router_id=5,
            status_filter=None,
            limit=10,
            current_user=operator,
            db=_RouterDB(router),
        )

    assert error.value.status_code == 404

@pytest.mark.asyncio
async def test_router_command_history_never_returns_command_parameters():
    router = SimpleNamespace(id=5, organization_id=10)
    command = SimpleNamespace(
        id="cmd-1",
        action="create_user",
        params={"password": "not-to-be-returned"},
        priority=2,
        status="pending",
        created_at=datetime.utcnow(),
        sent_at=None,
        completed_at=None,
        result_message="sensitive result",
        retry_count=0,
        source="test",
    )
    operator = SimpleNamespace(role=UserRole.ISP_ADMIN, organization_id=10)
    result = await get_router_commands(
        router_id=5,
        status_filter=None,
        limit=10,
        current_user=operator,
        db=_RouterDB(router, command),
    )

    assert result[0].params == {}
    assert result[0].result_message is None


@pytest.mark.asyncio
async def test_action_capability_is_bound_to_router_and_action():
    token = create_router_capability_token(
        capability="router_action",
        router_id=20,
        organization_id=2,
        router_action="reboot",
    )
    claims = verify_router_capability_token(token, capability="router_action")
    assert claims is not None
    assert claims["router_id"] == 20
    assert verify_token(token) is None

    with pytest.raises(HTTPException) as error:
        await get_router_action_script(
            router_id=10,
            action="reboot",
            token=token,
            db=_RouterDB(SimpleNamespace(id=10, organization_id=1)),
        )
    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_action_capability_cannot_change_its_parameters():
    token = create_router_capability_token(
        capability="router_action",
        router_id=10,
        organization_id=1,
        router_action="set_limits",
        parameters={"u": "alice", "lu": "1h"},
    )

    with pytest.raises(HTTPException) as error:
        await get_router_action_script(
            router_id=10,
            action="set_limits",
            token=token,
            u="bob",
            lu="1h",
            db=_RouterDB(SimpleNamespace(id=10, organization_id=1)),
        )
    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_backup_script_uses_a_scoped_token_not_the_reusable_agent_token(monkeypatch):
    router = SimpleNamespace(
        id=10,
        organization_id=1,
        agent_token_plain="reusable-agent-token",
        router_type=None,
    )
    backup = SimpleNamespace(id=12)

    class RouterService:
        def __init__(self, db, organization_id=None):
            assert organization_id == 1

        async def get_by_id(self, router_id):
            assert router_id == 10
            return router

    class BackupDB:
        async def execute(self, statement):
            return _Result(item=backup)

    monkeypatch.setattr(router_api, "RouterService", RouterService)
    action_token = create_router_capability_token(
        capability="router_action",
        router_id=10,
        organization_id=1,
        router_action="backup",
        parameters={"backup_id": 12},
    )

    script = await get_router_action_script(
        router_id=10,
        action="backup",
        token=action_token,
        u=None,
        lu=None,
        lb=None,
        backup_id=12,
        name=None,
        db=BackupDB(),
    )

    assert "reusable-agent-token" not in script
    upload_token = script.split("?token=", 1)[1].split("&", 1)[0]
    claims = verify_router_capability_token(
        upload_token,
        capability="router_backup_upload",
    )
    assert claims is not None
    assert claims["router_id"] == 10
    assert claims["resource_id"] == 12


@pytest.mark.asyncio
async def test_router_agent_dashboard_endpoints_require_authentication():
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    async def reject_auth(request: Request):
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[get_current_user] = reject_auth
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            status_response = await client.get("/api/v1/router-agent/status/1")
            commands_response = await client.get("/api/v1/router-agent/commands/1")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert status_response.status_code == 401
    assert commands_response.status_code == 401
