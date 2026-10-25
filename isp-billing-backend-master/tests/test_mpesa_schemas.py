"""Validation tests for the active billing API's M-PESA request schemas."""

import pytest
from pydantic import ValidationError

from app.schemas.billing import (
    MpesaCallbackRequest,
    MpesaCallbackResponse,
    MpesaPaymentRequest,
)


def test_mpesa_payment_request_accepts_valid_local_shape():
    request = MpesaPaymentRequest(
        phone_number="254712345678",
        amount=500,
        invoice_number="LOCAL-TEST-001",
    )

    assert request.phone_number == "254712345678"
    assert request.amount == 500


@pytest.mark.parametrize(
    "payload",
    [
        {"phone_number": "invalid", "amount": 500, "invoice_number": "INV-1"},
        {"phone_number": "254712345678", "amount": 0, "invoice_number": "INV-1"},
        {"phone_number": "254712345678", "amount": 70001, "invoice_number": "INV-1"},
    ],
)
def test_mpesa_payment_request_rejects_invalid_input(payload):
    with pytest.raises(ValidationError):
        MpesaPaymentRequest(**payload)


def test_mpesa_callback_request_requires_body_object():
    request = MpesaCallbackRequest(Body={"stkCallback": {"ResultCode": 0}})

    assert request.Body["stkCallback"]["ResultCode"] == 0


def test_mpesa_callback_response_requires_an_explicit_message():
    with pytest.raises(ValidationError):
        MpesaCallbackResponse(success=False)
