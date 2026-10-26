"""PayHero shared platform payment integration routes."""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.api.deps_tenant import get_current_organization, require_isp_admin
from app.core.config import settings
from app.integrations.payhero import PayHeroClient
from app.models.payment_gateway import PaymentTransaction, TenantPaymentChannel
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payhero", tags=["payhero"])


def _channel_status_payload(channel: TenantPaymentChannel) -> dict:
    return {
        "id": channel.id,
        "channel_type": channel.channel_type,
        "short_code": channel.short_code,
        "account_number": channel.account_number,
        "description": channel.description,
        "payhero_channel_id": channel.payhero_channel_id,
        "is_active": channel.is_active,
        "is_verified": channel.is_verified,
        "status": channel.status or "not_configured",
        "last_error": channel.last_error,
    }


@router.get("/channels")
async def list_payment_channels(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_isp_admin),
    organization=Depends(get_current_organization),
):
    client = PayHeroClient()
    try:
        remote = await client.list_payment_channels()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PayHero channel listing failed: {exc}")
    return {"organization_id": organization.id, "channels": remote}


@router.post("/channels")
async def register_payment_channel(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_isp_admin),
    organization=Depends(get_current_organization),
):
    channel_type = str(payload.get("channel_type", "till")).strip().lower()
    short_code = str(payload.get("short_code", "")).strip()
    account_number = payload.get("account_number")
    description = payload.get("description")

    if channel_type not in {"till", "paybill", "bank"}:
        raise HTTPException(status_code=422, detail="channel_type must be till, paybill, or bank")
    if not short_code:
        raise HTTPException(status_code=422, detail="short_code is required")
    if account_number is not None:
        account_number = str(account_number).strip() or None
    if description is not None:
        description = str(description).strip() or None

    # Idempotent lookup: reuse an existing channel record for this tenant + type + short_code.
    result = await db.execute(
        select(TenantPaymentChannel).where(
            TenantPaymentChannel.organization_id == organization.id,
            TenantPaymentChannel.channel_type == channel_type,
            TenantPaymentChannel.short_code == short_code,
        )
    )
    channel = result.scalar_one_or_none()

    if channel is None:
        channel = TenantPaymentChannel(
            organization_id=organization.id,
            channel_type=channel_type,
            short_code=short_code,
            account_number=account_number,
            description=description,
            payhero_channel_id=None,
            is_active=False,
            is_verified=False,
            status="configuration_incomplete",
        )
        db.add(channel)
        await db.flush()

    # Update mutable fields.
    channel.account_number = account_number
    channel.description = description
    channel.status = "validating"
    channel.last_error = None
    await db.commit()
    await db.refresh(channel)

    client = PayHeroClient()
    try:
        remote = await client.register_payment_channel(
            channel_type=channel_type,
            short_code=short_code,
            account_number=account_number or "",
            description=description or f"{channel_type} {short_code}",
        )
    except Exception as exc:
        channel.status = "failed"
        channel.last_error = str(exc)
        channel.is_verified = False
        channel.is_active = False
        await db.commit()
        await db.refresh(channel)
        raise HTTPException(status_code=502, detail=f"PayHero channel registration failed: {exc}")

    remote_id = remote.get("id")
    if remote_id is None:
        channel.status = "failed"
        channel.last_error = "PayHero did not return a channel id"
        channel.is_verified = False
        channel.is_active = False
        await db.commit()
        await db.refresh(channel)
        raise HTTPException(status_code=502, detail="PayHero did not return a channel id")

    channel.payhero_channel_id = int(remote_id)
    channel.is_active = bool(remote.get("is_active", True))
    channel.is_verified = True
    channel.status = "active"
    channel.last_error = None
    await db.commit()
    await db.refresh(channel)

    return _channel_status_payload(channel)


@router.get("/channels/local")
async def list_local_channels(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_isp_admin),
    organization=Depends(get_current_organization),
):
    result = await db.execute(
        select(TenantPaymentChannel).where(TenantPaymentChannel.organization_id == organization.id)
    )
    channels = result.scalars().all()
    return [_channel_status_payload(c) for c in channels]


@router.post("/initiate")
async def initiate_payment(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization=Depends(get_current_organization),
):
    # Resolve channel owned by this tenant.
    channel_id = payload.get("payhero_channel_id")
    channel = None
    if channel_id:
        result = await db.execute(
            select(TenantPaymentChannel).where(
                TenantPaymentChannel.organization_id == organization.id,
                TenantPaymentChannel.payhero_channel_id == int(channel_id),
            )
        )
        channel = result.scalar_one_or_none()
        if channel is None:
            raise HTTPException(status_code=404, detail="Payment channel not found for this organization")
    else:
        result = await db.execute(
            select(TenantPaymentChannel).where(
                TenantPaymentChannel.organization_id == organization.id,
                TenantPaymentChannel.is_active == True,
            )
        )
        channel = result.scalars().first()
        if not channel:
            raise HTTPException(status_code=400, detail="No active payment channel configured for this organization")

    amount = payload.get("amount")
    phone_number = payload.get("phone_number")
    if not amount or not phone_number:
        raise HTTPException(status_code=422, detail="amount and phone_number are required")

    external_reference = payload.get("external_reference") or f"PH-{organization.id}-{int(datetime.utcnow().timestamp())}"

    transaction = PaymentTransaction(
        organization_id=organization.id,
        transaction_reference=external_reference,
        amount=Decimal(str(amount)),
        currency=payload.get("currency", "KES"),
        transaction_type="payment",
        status="pending",
        phone_number=phone_number,
        account_reference=payload.get("account_reference"),
        invoice_id=payload.get("invoice_id"),
        subscription_id=payload.get("subscription_id"),
        user_id=payload.get("user_id"),
        ip_address=payload.get("ip_address"),
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    callback_url = settings.payhero_callback_url or f"{settings.backend_url or ''}/api/v1/payments/payhero/callback"

    client = PayHeroClient()
    try:
        remote = await client.initiate_stk_push(
            amount=int(Decimal(str(amount))),
            phone_number=phone_number,
            channel_id=int(channel.payhero_channel_id),
            external_reference=external_reference,
            customer_name=payload.get("customer_name"),
            callback_url=callback_url,
        )
    except Exception as exc:
        transaction.status = "failed"
        transaction.status_message = str(exc)
        await db.commit()
        raise HTTPException(status_code=502, detail=f"PayHero initiation failed: {exc}")

    transaction.external_reference = remote.get("reference") or external_reference
    transaction.callback_data = remote
    await db.commit()

    return {
        "success": remote.get("success", False),
        "status": remote.get("status"),
        "reference": remote.get("reference"),
        "checkout_request_id": remote.get("CheckoutRequestID"),
        "transaction_id": transaction.id,
    }


@router.post("/callback")
async def payment_callback(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    response = body.get("response", {}) if isinstance(body.get("response"), dict) else {}
    external_reference = response.get("ExternalReference")
    checkout_request_id = response.get("CheckoutRequestID")
    result_code = response.get("ResultCode")
    status_str = response.get("Status")
    mpesa_receipt = response.get("MpesaReceiptNumber")
    amount = response.get("Amount")
    phone = response.get("Phone")

    if not external_reference:
        raise HTTPException(status_code=400, detail="Missing ExternalReference")

    # Locate transaction by either reference column, scoped by tenant implicitly.
    result = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.transaction_reference == external_reference)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        result = await db.execute(
            select(PaymentTransaction).where(PaymentTransaction.external_reference == external_reference)
        )
        transaction = result.scalar_one_or_none()

    if not transaction:
        logger.warning("PayHero callback for unknown reference: %s", external_reference)
        return {"status": "ignored", "reason": "unknown reference"}

    # Idempotency: already completed
    if transaction.status == "completed":
        return {"status": "already_processed"}

    # Optional callback-level status check.
    callback_ok = body.get("status", True)
    if callback_ok is False:
        transaction.status = "failed"
        transaction.status_message = "Callback reported failure"
        transaction.callback_data = body
        transaction.processed_at = datetime.utcnow()
        await db.commit()
        return {"status": "failed", "reason": "callback status false"}

    success = result_code == 0 and bool(status_str) and str(status_str).lower() == "success"

    # Amount verification against the initiated transaction.
    if amount is not None and success:
        try:
            cb_amount = Decimal(str(amount))
        except Exception:
            cb_amount = None
        if cb_amount is not None and cb_amount != transaction.amount:
            transaction.status = "failed"
            transaction.status_message = (
                f"Amount mismatch: expected {transaction.amount}, received {cb_amount}"
            )
            transaction.callback_data = body
            transaction.processed_at = datetime.utcnow()
            await db.commit()
            logger.warning("PayHero amount mismatch: %s", external_reference)
            return {"status": "failed", "reason": "amount mismatch"}

    if success:
        from app.models.billing import Payment, PaymentStatus, PaymentMethod
        from app.modules.billing.service import BillingService

        paid_amount = transaction.amount
        if amount is not None:
            try:
                paid_amount = Decimal(str(amount))
            except Exception:
                paid_amount = transaction.amount

        receipt_ref = mpesa_receipt or transaction.external_reference or transaction.transaction_reference
        transaction.external_reference = receipt_ref
        transaction.completed_at = datetime.utcnow()
        transaction.processed_at = datetime.utcnow()
        transaction.callback_data = body
        transaction.status = "completed"
        await db.commit()

        # Create a Payment record (idempotent: reuse if one already exists).
        billing = BillingService(db, organization_id=transaction.organization_id)
        existing_payment = await db.execute(
            select(Payment).where(Payment.reference_number == receipt_ref)
        )
        payment = existing_payment.scalar_one_or_none()
        if payment is None:
            payment_number = await billing._generate_payment_number()
            payment = Payment(
                organization_id=transaction.organization_id,
                user_id=transaction.user_id,
                invoice_id=transaction.invoice_id,
                payment_number=payment_number,
                amount=paid_amount,
                currency=transaction.currency or "KES",
                payment_method=PaymentMethod.MPESA,
                status=PaymentStatus.COMPLETED,
                transaction_id=transaction.transaction_reference,
                reference_number=receipt_ref,
                notes=f"PayHero payment {external_reference}",
                payment_date=datetime.utcnow(),
                processed_date=datetime.utcnow(),
            )
            db.add(payment)
            await db.commit()
            await db.refresh(payment)

        # Allocate to invoice (marks paid + activates linked subscription).
        if transaction.invoice_id:
            await billing._apply_payment_to_invoice(transaction.invoice_id, paid_amount)

        # Activate subscription if directly linked (idempotent).
        if transaction.subscription_id:
            await billing._activate_subscription_on_payment(transaction.subscription_id)

        logger.info("PayHero payment completed and activated: %s", external_reference)
    else:
        transaction.status = "failed"
        transaction.status_message = response.get("ResultDesc", "Payment failed")
        transaction.callback_data = body
        transaction.processed_at = datetime.utcnow()
        await db.commit()
        logger.info("PayHero payment failed: %s", external_reference)

    return {"status": "received"}


@router.get("/status/{reference}")
async def get_payment_status(
    reference: str,
    db: AsyncSession = Depends(get_db),
):
    client = PayHeroClient()
    try:
        remote = await client.get_transaction_status(reference)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PayHero status query failed: {exc}")
    return remote
"""PayHero shared platform payment integration routes."""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.api.deps_tenant import get_current_organization, require_isp_admin
from app.core.config import settings
from app.integrations.payhero import PayHeroClient
from app.models.payment_gateway import PaymentTransaction, TenantPaymentChannel
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payhero", tags=["payhero"])


def _channel_status_payload(channel: TenantPaymentChannel) -> dict:
    return {
        "id": channel.id,
        "channel_type": channel.channel_type,
        "short_code": channel.short_code,
        "account_number": channel.account_number,
        "description": channel.description,
        "payhero_channel_id": channel.payhero_channel_id,
        "is_active": channel.is_active,
        "is_verified": channel.is_verified,
        "status": channel.status or "not_configured",
        "last_error": channel.last_error,
    }


@router.get("/channels")
async def list_payment_channels(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_isp_admin),
    organization=Depends(get_current_organization),
):
    client = PayHeroClient()
    try:
        remote = await client.list_payment_channels()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PayHero channel listing failed: {exc}")
    return {"organization_id": organization.id, "channels": remote}


@router.post("/channels")
async def register_payment_channel(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_isp_admin),
    organization=Depends(get_current_organization),
):
    channel_type = str(payload.get("channel_type", "till")).strip().lower()
    short_code = str(payload.get("short_code", "")).strip()
    account_number = payload.get("account_number")
    description = payload.get("description")

    if channel_type not in {"till", "paybill", "bank"}:
        raise HTTPException(status_code=422, detail="channel_type must be till, paybill, or bank")
    if not short_code:
        raise HTTPException(status_code=422, detail="short_code is required")
    if account_number is not None:
        account_number = str(account_number).strip() or None
    if description is not None:
        description = str(description).strip() or None

    result = await db.execute(
        select(TenantPaymentChannel).where(
            TenantPaymentChannel.organization_id == organization.id,
            TenantPaymentChannel.channel_type == channel_type,
            TenantPaymentChannel.short_code == short_code,
        )
    )
    channel = result.scalar_one_or_none()

    if channel is None:
        channel = TenantPaymentChannel(
            organization_id=organization.id,
            channel_type=channel_type,
            short_code=short_code,
            account_number=account_number,
            description=description,
            payhero_channel_id=None,
            is_active=False,
            is_verified=False,
            status="configuration_incomplete",
        )
        db.add(channel)
        await db.flush()

    channel.account_number = account_number
    channel.description = description
    channel.status = "validating"
    channel.last_error = None
    await db.commit()
    await db.refresh(channel)

    client = PayHeroClient()
    try:
        remote = await client.register_payment_channel(
            channel_type=channel_type,
            short_code=short_code,
            account_number=account_number or "",
            description=description or f"{channel_type} {short_code}",
        )
    except Exception as exc:
        channel.status = "failed"
        channel.last_error = str(exc)
        channel.is_verified = False
        channel.is_active = False
        await db.commit()
        await db.refresh(channel)
        raise HTTPException(status_code=502, detail=f"PayHero channel registration failed: {exc}")

    remote_id = remote.get("id")
    if remote_id is None:
        channel.status = "failed"
        channel.last_error = "PayHero did not return a channel id"
        channel.is_verified = False
        channel.is_active = False
        await db.commit()
        await db.refresh(channel)
        raise HTTPException(status_code=502, detail="PayHero did not return a channel id")

    channel.payhero_channel_id = int(remote_id)
    channel.is_active = bool(remote.get("is_active", True))
    channel.is_verified = True
    channel.status = "active"
    channel.last_error = None
    await db.commit()
    await db.refresh(channel)

    return _channel_status_payload(channel)


@router.get("/channels/local")
async def list_local_channels(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_isp_admin),
    organization=Depends(get_current_organization),
):
    result = await db.execute(
        select(TenantPaymentChannel).where(TenantPaymentChannel.organization_id == organization.id)
    )
    channels = result.scalars().all()
    return [_channel_status_payload(c) for c in channels]


@router.post("/initiate")
async def initiate_payment(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization=Depends(get_current_organization),
):
    channel_id = payload.get("payhero_channel_id")
    channel = None
    if channel_id:
        result = await db.execute(
            select(TenantPaymentChannel).where(
                TenantPaymentChannel.organization_id == organization.id,
                TenantPaymentChannel.payhero_channel_id == int(channel_id),
            )
        )
        channel = result.scalar_one_or_none()
        if channel is None:
            raise HTTPException(status_code=404, detail="Payment channel not found for this organization")
    else:
        result = await db.execute(
            select(TenantPaymentChannel).where(
                TenantPaymentChannel.organization_id == organization.id,
                TenantPaymentChannel.is_active == True,
            )
        )
        channel = result.scalars().first()
        if not channel:
            raise HTTPException(status_code=400, detail="No active payment channel configured for this organization")

    amount = payload.get("amount")
    phone_number = payload.get("phone_number")
    if not amount or not phone_number:
        raise HTTPException(status_code=422, detail="amount and phone_number are required")

    external_reference = payload.get("external_reference") or f"PH-{organization.id}-{int(datetime.utcnow().timestamp())}"

    transaction = PaymentTransaction(
        organization_id=organization.id,
        transaction_reference=external_reference,
        amount=Decimal(str(amount)),
        currency=payload.get("currency", "KES"),
        transaction_type="payment",
        status="pending",
        phone_number=phone_number,
        account_reference=payload.get("account_reference"),
        invoice_id=payload.get("invoice_id"),
        subscription_id=payload.get("subscription_id"),
        user_id=payload.get("user_id"),
        ip_address=payload.get("ip_address"),
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    callback_url = settings.payhero_callback_url or f"{settings.backend_url or ''}/api/v1/payments/payhero/callback"

    client = PayHeroClient()
    try:
        remote = await client.initiate_stk_push(
            amount=int(Decimal(str(amount))),
            phone_number=phone_number,
            channel_id=int(channel.payhero_channel_id),
            external_reference=external_reference,
            customer_name=payload.get("customer_name"),
            callback_url=callback_url,
        )
    except Exception as exc:
        transaction.status = "failed"
        transaction.status_message = str(exc)
        await db.commit()
        raise HTTPException(status_code=502, detail=f"PayHero initiation failed: {exc}")

    transaction.external_reference = remote.get("reference") or external_reference
    transaction.callback_data = remote
    await db.commit()

    return {
        "success": remote.get("success", False),
        "status": remote.get("status"),
        "reference": remote.get("reference"),
        "checkout_request_id": remote.get("CheckoutRequestID"),
        "transaction_id": transaction.id,
    }


@router.post("/callback")
async def payment_callback(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    response = body.get("response", {}) if isinstance(body.get("response"), dict) else {}
    external_reference = response.get("ExternalReference")
    checkout_request_id = response.get("CheckoutRequestID")
    result_code = response.get("ResultCode")
    status_str = response.get("Status")
    mpesa_receipt = response.get("MpesaReceiptNumber")
    amount = response.get("Amount")
    phone = response.get("Phone")

    if not external_reference:
        raise HTTPException(status_code=400, detail="Missing ExternalReference")

    result = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.transaction_reference == external_reference)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        result = await db.execute(
            select(PaymentTransaction).where(PaymentTransaction.external_reference == external_reference)
        )
        transaction = result.scalar_one_or_none()

    if not transaction:
        logger.warning("PayHero callback for unknown reference: %s", external_reference)
        return {"status": "ignored", "reason": "unknown reference"}

    if transaction.status == "completed":
        return {"status": "already_processed"}

    callback_ok = body.get("status", True)
    if callback_ok is False:
        transaction.status = "failed"
        transaction.status_message = "Callback reported failure"
        transaction.callback_data = body
        transaction.processed_at = datetime.utcnow()
        await db.commit()
        return {"status": "failed", "reason": "callback status false"}

    success = result_code == 0 and bool(status_str) and str(status_str).lower() == "success"

    if amount is not None and success:
        try:
            cb_amount = Decimal(str(amount))
        except Exception:
            cb_amount = None
        if cb_amount is not None and cb_amount != transaction.amount:
            transaction.status = "failed"
            transaction.status_message = (
                f"Amount mismatch: expected {transaction.amount}, received {cb_amount}"
            )
            transaction.callback_data = body
            transaction.processed_at = datetime.utcnow()
            await db.commit()
            logger.warning("PayHero amount mismatch: %s", external_reference)
            return {"status": "failed", "reason": "amount mismatch"}

    if success:
        from app.models.billing import Payment, PaymentStatus, PaymentMethod
        from app.modules.billing.service import BillingService

        paid_amount = transaction.amount
        if amount is not None:
            try:
                paid_amount = Decimal(str(amount))
            except Exception:
                paid_amount = transaction.amount

        receipt_ref = mpesa_receipt or transaction.external_reference or transaction.transaction_reference
        transaction.external_reference = receipt_ref
        transaction.completed_at = datetime.utcnow()
        transaction.processed_at = datetime.utcnow()
        transaction.callback_data = body
        transaction.status = "completed"
        await db.commit()

        billing = BillingService(db, organization_id=transaction.organization_id)
        existing_payment = await db.execute(
            select(Payment).where(Payment.reference_number == receipt_ref)
        )
        payment = existing_payment.scalar_one_or_none()
        if payment is None:
            payment_number = await billing._generate_payment_number()
            payment = Payment(
                organization_id=transaction.organization_id,
                user_id=transaction.user_id,
                invoice_id=transaction.invoice_id,
                payment_number=payment_number,
                amount=paid_amount,
                currency=transaction.currency or "KES",
                payment_method=PaymentMethod.MPESA,
                status=PaymentStatus.COMPLETED,
                transaction_id=transaction.transaction_reference,
                reference_number=receipt_ref,
                notes=f"PayHero payment {external_reference}",
                payment_date=datetime.utcnow(),
                processed_date=datetime.utcnow(),
            )
            db.add(payment)
            await db.commit()
            await db.refresh(payment)

        if transaction.invoice_id:
            await billing._apply_payment_to_invoice(transaction.invoice_id, paid_amount)

        if transaction.subscription_id:
            await billing._activate_subscription_on_payment(transaction.subscription_id)

        logger.info("PayHero payment completed and activated: %s", external_reference)
    else:
        transaction.status = "failed"
        transaction.status_message = response.get("ResultDesc", "Payment failed")
        transaction.callback_data = body
        transaction.processed_at = datetime.utcnow()
        await db.commit()
        logger.info("PayHero payment failed: %s", external_reference)

    return {"status": "received"}


@router.get("/status/{reference}")
async def get_payment_status(
    reference: str,
    db: AsyncSession = Depends(get_db),
):
    client = PayHeroClient()
    try:
        remote = await client.get_transaction_status(reference)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PayHero status query failed: {exc}")
    return remote
