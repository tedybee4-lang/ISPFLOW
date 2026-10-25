from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.support import tickets
from app.models.user import UserRole
from app.schemas.ticket import (
    SupportTicketCreate,
    TicketAssignmentRequest,
    TicketMessageCreate,
)


class _Result:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _FakeDatabase:
    def __init__(self, value=None):
        self.value = value
        self.calls = 0

    async def execute(self, _query):
        self.calls += 1
        return _Result(self.value)


@pytest.mark.asyncio
async def test_customer_ticket_list_is_forced_to_authenticated_customer(monkeypatch):
    captured = {}

    class _FakeTicketService:
        def __init__(self, _db, _org_id, _user_id):
            pass

        async def get_all(self, **kwargs):
            captured.update(kwargs)
            return {"tickets": [], "total": 0, "page": 1, "size": 20, "pages": 0}

    monkeypatch.setattr(tickets, "TicketService", _FakeTicketService)
    user = SimpleNamespace(id=22, role=UserRole.CUSTOMER)

    await tickets.get_tickets(
        pagination=SimpleNamespace(page=1, size=20, offset=0),
        status_filter=None,
        priority=None,
        user_id=None,
        assigned_to=None,
        category=None,
        search=None,
        org_id=7,
        current_user=user,
        db=object(),
    )

    assert captured["user_id"] == user.id


@pytest.mark.asyncio
async def test_customer_cannot_filter_ticket_list_for_another_user():
    with pytest.raises(HTTPException) as error:
        await tickets.get_tickets(
            pagination=SimpleNamespace(page=1, size=20, offset=0),
            status_filter=None,
            priority=None,
            user_id=99,
            assigned_to=None,
            category=None,
            search=None,
            org_id=7,
            current_user=SimpleNamespace(id=22, role=UserRole.CUSTOMER),
            db=object(),
        )

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_customer_cannot_create_ticket_for_another_user():
    with pytest.raises(HTTPException) as error:
        await tickets.create_ticket(
            SupportTicketCreate(
                user_id=99,
                subject="Unauthorized case",
                description="Customer must not create a case for another account.",
            ),
            org_id=7,
            current_user=SimpleNamespace(id=22, role=UserRole.CUSTOMER),
            db=object(),
        )

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_customer_cannot_read_another_customers_ticket(monkeypatch):
    class _FakeTicketService:
        def __init__(self, _db, _org_id, _user_id):
            pass

        async def get_by_id(self, _ticket_id):
            return SimpleNamespace(user_id=99)

    monkeypatch.setattr(tickets, "TicketService", _FakeTicketService)

    with pytest.raises(HTTPException) as error:
        await tickets.get_ticket(
            ticket_id=15,
            org_id=7,
            current_user=SimpleNamespace(id=22, role=UserRole.CUSTOMER),
            db=object(),
        )

    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_customer_cannot_add_internal_ticket_note(monkeypatch):
    class _FakeTicketService:
        def __init__(self, _db, _org_id, _user_id):
            pass

        async def get_by_id(self, _ticket_id):
            return SimpleNamespace(user_id=22)

    monkeypatch.setattr(tickets, "TicketService", _FakeTicketService)

    with pytest.raises(HTTPException) as error:
        await tickets.add_ticket_message(
            ticket_id=15,
            message_data=TicketMessageCreate(message="Private note", is_internal=True),
            org_id=7,
            current_user=SimpleNamespace(id=22, role=UserRole.CUSTOMER),
            db=object(),
        )

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_customer_ticket_response_hides_internal_messages(monkeypatch):
    now = datetime.utcnow()
    ticket = SimpleNamespace(
        id=15,
        user_id=22,
        subject="Connection issue",
        description="Customer cannot connect.",
        category="technical",
        priority="medium",
        tags=None,
        attachments=None,
        ticket_number="TKT-LOCAL-15",
        status="open",
        assigned_to=None,
        resolution=None,
        resolved_at=None,
        closed_at=None,
        created_at=now,
        updated_at=now,
        messages=[
            {
                "id": 1,
                "ticket_id": 15,
                "user_id": 22,
                "message": "Public update",
                "is_internal": False,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": 2,
                "ticket_id": 15,
                "user_id": 10,
                "message": "Staff-only note",
                "is_internal": True,
                "created_at": now,
                "updated_at": now,
            },
        ],
    )

    class _FakeTicketService:
        def __init__(self, _db, _org_id, _user_id):
            pass

        async def get_by_id(self, _ticket_id):
            return ticket

    monkeypatch.setattr(tickets, "TicketService", _FakeTicketService)
    response = await tickets.get_ticket(
        ticket_id=15,
        org_id=7,
        current_user=SimpleNamespace(id=22, role=UserRole.CUSTOMER),
        db=object(),
    )

    assert [message.message for message in response.messages] == ["Public update"]


@pytest.mark.asyncio
async def test_ticket_assignment_rejects_staff_from_another_organization():
    with pytest.raises(HTTPException) as error:
        await tickets.assign_ticket(
            ticket_id=15,
            assignment_data=TicketAssignmentRequest(ticket_id=15, assigned_to=44),
            org_id=7,
            current_user=SimpleNamespace(id=10, role=UserRole.ISP_ADMIN),
            db=_FakeDatabase(),
        )

    assert error.value.status_code == 404


def test_ticket_assignment_can_be_cleared():
    assert TicketAssignmentRequest(ticket_id=15, assigned_to=None).assigned_to is None


@pytest.mark.asyncio
async def test_ticket_unassignment_does_not_look_up_a_staff_user(monkeypatch):
    ticket = SimpleNamespace(
        id=15,
        user_id=22,
        subject="Connection issue",
        description="Customer cannot connect.",
        category="technical",
        priority="medium",
        tags=None,
        attachments=None,
        ticket_number="TKT-LOCAL-15",
        status="in_progress",
        assigned_to=None,
        resolution=None,
        resolved_at=None,
        closed_at=None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        messages=[],
    )
    assignments = []

    class _FakeTicketService:
        def __init__(self, _db, _org_id, _user_id):
            pass

        async def assign_ticket(self, ticket_id, assigned_to):
            assignments.append((ticket_id, assigned_to))
            return ticket

    monkeypatch.setattr(tickets, "TicketService", _FakeTicketService)
    db = _FakeDatabase()
    await tickets.assign_ticket(
        ticket_id=15,
        assignment_data=TicketAssignmentRequest(ticket_id=15, assigned_to=None),
        org_id=7,
        current_user=SimpleNamespace(id=10, role=UserRole.ISP_ADMIN),
        db=db,
    )

    assert assignments == [(15, None)]
    assert db.calls == 0
