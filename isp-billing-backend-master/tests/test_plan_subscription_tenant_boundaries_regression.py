"""Focused tenant-boundary regressions for plans and subscriptions."""

from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.business import subscriptions as subscriptions_api
from app.api.v1.business.subscriptions import router as subscriptions_router
from app.modules.plans.service import PlanService
from app.modules.subscriptions.service import SubscriptionService
from app.models.plan import PlanType
from app.models.user import UserRole
from app.schemas.subscription import Subscription as SubscriptionResponse
from app.schemas.subscription import SubscriptionCreate


class _Result:
    def __init__(self, item=None, rowcount=0):
        self.item = item
        self.rowcount = rowcount

    def scalar_one_or_none(self):
        return self.item

    def scalar(self):
        return self.item

    def scalars(self):
        return self

    def all(self):
        return []

    def fetchall(self):
        return []


class _FakeDB:
    def __init__(self, results=None):
        self.statements = []
        self.results = list(results or [])
        self.commits = 0

    async def execute(self, statement):
        self.statements.append(statement)
        result = self.results.pop(0) if self.results else None
        if isinstance(result, tuple):
            item, rowcount = result
            return _Result(item, rowcount)
        return _Result(result)

    async def commit(self):
        self.commits += 1


def _sql(statement):
    return str(statement.compile(compile_kwargs={"literal_binds": True})).lower()


@pytest.mark.asyncio
async def test_plan_id_lookup_and_child_delete_are_scoped_to_organization():
    db = _FakeDB()
    plans = PlanService(db)

    assert await plans.get_by_id(91, organization_id=12) is None
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])

    assert await plans.remove_plan_feature(77, organization_id=12) is False
    child_query = _sql(db.statements[-1])
    assert "plan_features.id = 77" in child_query
    assert "service_plans.organization_id = 12" in child_query
    assert db.commits == 0


@pytest.mark.asyncio
async def test_plan_mutations_and_child_creation_require_scoped_parent():
    db = _FakeDB()
    plans = PlanService(db)

    assert await plans.update_plan(91, {"name": "changed"}, 12) is None
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])
    assert await plans.activate_plan(91, 12) is None
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])
    assert await plans.deactivate_plan(91, 12) is None
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])

    with pytest.raises(ValueError, match="Plan not found"):
        await plans.add_plan_feature(91, "f", 12)
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])
    with pytest.raises(ValueError, match="Plan not found"):
        await plans.add_plan_pricing(91, 12, 1, 5)
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])
    assert db.commits == 0


@pytest.mark.asyncio
async def test_plan_delete_stats_and_child_reads_are_scoped():
    db = _FakeDB()
    plans = PlanService(db)

    assert await plans.delete_plan(91, 12) is False
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])
    assert await plans.get_plan_stats(91, 12) == {}
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])
    assert await plans.get_plan_features(91, 12) == []
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])
    assert await plans.get_plan_pricing(91, 12) == []
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])
    assert db.commits == 0


@pytest.mark.asyncio
async def test_popular_type_and_summary_plan_queries_are_scoped():
    db = _FakeDB()
    plans = PlanService(db)

    await plans.get_popular_plans(organization_id=12, limit=5)
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])

    await plans.get_plans_by_type(
        PlanType.PPPOE, organization_id=12, limit=5
    )
    assert "service_plans.organization_id = 12" in _sql(db.statements[-1])

    await plans.get_plan_stats_summary(organization_id=12)
    summary_queries = [_sql(statement) for statement in db.statements[-3:]]
    assert all("service_plans.organization_id = 12" in query for query in summary_queries)


@pytest.mark.asyncio
async def test_plan_update_statement_repeats_organization_predicate():
    plan = SimpleNamespace(id=91)
    db = _FakeDB([plan, (None, 1), None])
    plans = PlanService(db)

    assert await plans.update_plan(91, {"name": "changed"}, 12) is None
    update_sql = next(sql for sql in map(_sql, db.statements) if "update service_plans" in sql)
    assert "service_plans.id = 91" in update_sql
    assert "service_plans.organization_id = 12" in update_sql


@pytest.mark.asyncio
async def test_subscription_id_read_and_mutations_are_scoped_to_organization():
    db = _FakeDB()
    subscriptions = SubscriptionService(db, auto_sync_router=False)

    assert await subscriptions.get_by_id(91, organization_id=12) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])

    assert await subscriptions.update_subscription(91, {"notes": "x"}, organization_id=12) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])
    assert await subscriptions.activate_subscription(91, organization_id=12) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])
    assert await subscriptions.renew_subscription(
        91, datetime(2030, 1, 1), organization_id=12
    ) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])
    assert await subscriptions.update_usage(
        91, 1, 2, organization_id=12
    ) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])
    assert await subscriptions.delete_subscription(91, organization_id=12) is False
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])
    assert await subscriptions.suspend_subscription(91, organization_id=12) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])
    assert await subscriptions.cancel_subscription(91, organization_id=12) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])
    assert await subscriptions.get_subscription_stats(91, 12) == {}
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])
    assert await subscriptions.get_usage_logs(91, organization_id=12) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])
    assert await subscriptions.get_subscription_history(91, 12) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])


@pytest.mark.asyncio
async def test_expired_and_expiring_subscription_queries_are_scoped():
    db = _FakeDB()
    subscriptions = SubscriptionService(db, auto_sync_router=False)

    await subscriptions.get_expired_subscriptions(organization_id=12)
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])

    await subscriptions.get_expiring_subscriptions(organization_id=12, days=4)
    assert "subscriptions.organization_id = 12" in _sql(db.statements[-1])


@pytest.mark.asyncio
async def test_user_subscription_lookup_checks_tenant_and_caller_identity(monkeypatch):
    db = _FakeDB()
    service = SubscriptionService(db, auto_sync_router=False)
    await service.get_user_subscriptions(user_id=44, organization_id=12)
    query = _sql(db.statements[-1])
    assert "users.organization_id = 12" in query
    assert "subscriptions.organization_id = 12" in query

    calls = []

    class FakeService:
        def __init__(self, _db):
            pass

        async def get_user_subscriptions(self, user_id, active_only, organization_id):
            calls.append((user_id, active_only, organization_id))
            return []

    monkeypatch.setattr(subscriptions_api, "SubscriptionService", FakeService)
    customer = SimpleNamespace(role=UserRole.CUSTOMER, id=44)

    with pytest.raises(HTTPException) as error:
        await subscriptions_api.get_user_subscriptions(
            user_id=45,
            org_id=12,
            current_user=customer,
            db=object(),
        )
    assert error.value.status_code == 403
    assert calls == []

    await subscriptions_api.get_user_subscriptions(
        user_id=44,
        active_only=False,
        org_id=12,
        current_user=customer,
        db=object(),
    )
    await subscriptions_api.get_user_subscriptions(
        user_id=44,
        active_only=False,
        org_id=12,
        current_user=SimpleNamespace(role=UserRole.ISP_ADMIN, id=99),
        db=object(),
    )
    assert calls == [(44, False, 12), (44, False, 12)]


@pytest.mark.asyncio
async def test_subscription_management_routes_require_staff_roles():
    staff_routes = {
        "get_subscriptions",
        "create_subscription",
        "get_subscription",
        "update_subscription",
        "delete_subscription",
        "activate_subscription",
        "suspend_subscription",
        "cancel_subscription",
        "renew_subscription",
        "get_subscription_stats",
        "get_subscription_usage",
        "update_subscription_usage",
        "get_subscription_history",
        "get_expired_subscriptions",
        "get_expiring_subscriptions",
    }
    technician = SimpleNamespace(role=UserRole.ISP_TECHNICIAN)
    customer = SimpleNamespace(role=UserRole.CUSTOMER)
    checked = set()

    for route in subscriptions_router.routes:
        if route.name not in staff_routes:
            continue
        user_dependency = next(
            dependency
            for dependency in route.dependant.dependencies
            if dependency.name == "current_user"
        )
        assert await user_dependency.call(current_user=technician) is technician
        with pytest.raises(HTTPException) as error:
            await user_dependency.call(current_user=customer)
        assert getattr(error.value, "status_code", None) == 403
        checked.add(route.name)

    assert checked == staff_routes


@pytest.mark.asyncio
async def test_subscription_update_rejects_foreign_plan_or_router():
    subscription = SimpleNamespace(id=91)
    db = _FakeDB([subscription, None, subscription, None])
    subscriptions = SubscriptionService(db, auto_sync_router=False)

    assert await subscriptions.update_subscription(
        91, {"plan_id": 99}, organization_id=12
    ) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[0])
    assert "service_plans.organization_id = 12" in _sql(db.statements[1])

    assert await subscriptions.update_subscription(
        91, {"router_id": 99}, organization_id=12
    ) is None
    assert "subscriptions.organization_id = 12" in _sql(db.statements[2])
    assert "routers.organization_id = 12" in _sql(db.statements[3])
    assert db.commits == 0


@pytest.mark.asyncio
async def test_subscription_mutation_statement_repeats_organization_predicate():
    subscription = SimpleNamespace(id=91, status=None)
    db = _FakeDB([subscription, (None, 1), None])
    subscriptions = SubscriptionService(db, auto_sync_router=False)

    assert await subscriptions.update_subscription(
        91, {"notes": "updated"}, organization_id=12
    ) is None
    update_sql = next(
        sql for sql in map(_sql, db.statements) if "update subscriptions" in sql
    )
    assert "subscriptions.id = 91" in update_sql
    assert "subscriptions.organization_id = 12" in update_sql


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("results", "expected_message", "expected_queries"),
    [
        ([], "User not found", 1),
        ([SimpleNamespace(id=1, username="u")], "Service plan not found", 2),
        (
            [SimpleNamespace(id=1, username="u"), SimpleNamespace(id=2)],
            "Router not found",
            3,
        ),
    ],
)
async def test_creation_checks_user_plan_router_tenant_before_inserting(
    results, expected_message, expected_queries
):
    db = _FakeDB(results)
    subscriptions = SubscriptionService(db, auto_sync_router=False)

    with pytest.raises(ValueError, match=expected_message):
        await subscriptions.create_subscription(
            user_id=1,
            plan_id=2,
            router_id=3,
            subscription_type="pppoe",
            username="u",
            password="secret",
            start_date=datetime(2030, 1, 1),
            end_date=datetime(2030, 1, 2),
            organization_id=12,
        )

    assert len(db.statements) == expected_queries
    rendered = [_sql(statement) for statement in db.statements]
    expected_tenant_tables = ["users", "service_plans", "routers"]
    for index, query in enumerate(rendered):
        assert f"{expected_tenant_tables[index]}.organization_id = 12" in query
    assert db.commits == 0


def test_general_subscription_response_does_not_include_credentials():
    response_fields = getattr(SubscriptionResponse, "model_fields", None)
    if response_fields is None:
        response_fields = SubscriptionResponse.__fields__
    create_fields = getattr(SubscriptionCreate, "model_fields", None)
    if create_fields is None:
        create_fields = SubscriptionCreate.__fields__

    assert "password" not in response_fields
    assert "password" in create_fields
