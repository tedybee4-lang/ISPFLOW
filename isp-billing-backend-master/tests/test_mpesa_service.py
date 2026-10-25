"""Tests that retired direct M-PESA operations fail closed without network I/O."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.billing.mpesa import MpesaService


@pytest.fixture
def mpesa_service():
    return MpesaService(AsyncMock())


@pytest.mark.asyncio
async def test_direct_gateway_is_disabled(mpesa_service):
    assert mpesa_service.is_configured is False
    assert mpesa_service.gateway is None


@pytest.mark.asyncio
async def test_payment_initiation_fails_closed_without_gateway(mpesa_service):
    result = await mpesa_service.initiate_payment(
        user=SimpleNamespace(id=10, phone_number="254712345678"),
        amount=500,
        account_reference="LOCAL-TEST-001",
        description="Local test only",
    )

    assert result["success"] is False
    assert "unavailable" in result["message"].lower()
    mpesa_service.db.add.assert_not_called()


@pytest.mark.asyncio
async def test_payment_status_query_fails_closed_without_gateway(mpesa_service):
    result = await mpesa_service.query_payment_status("LOCAL-TEST-REF")

    assert result["success"] is False
    assert "unavailable" in result["message"].lower()
    mpesa_service.db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_callback_processing_fails_closed_without_gateway(mpesa_service):
    result = await mpesa_service.process_callback(
        {"Body": {"stkCallback": {"ResultCode": 0}}}
    )

    assert result["success"] is False
    assert "unavailable" in result["message"].lower()
    mpesa_service.db.execute.assert_not_awaited()
