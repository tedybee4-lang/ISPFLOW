"""PayHero shared platform payment integration routes."""

import logging
from datetime import datetime
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
    client = PayHeroClient()
    try:
        remote = await client.register_payment_channel(
            channel_type=payload.get("channel_type", "till"),
            short_code=str(payload.get("short_code", "")),
            account_number=payload.get("account_number", ""),
            description=payload.get("description", ""),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PayHero channel registration failed: {exc}")

    channel = TenantPaymentChannel(
        organization_id=organization.id,
        channel_type=payload.get("channel_type", "till"),
        short_code=str(payload.get("short_code", "")),
        account_number=payload.get("account_number"),
        description=payload.get("description"),
        payhero_channel_id=remote.get("id"),
        is_active=remote.get("is_active", True),
        is_verified=True,
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return {"id": channel.id, "payhero_channel_id": channel.payhero_channel_id, "is_active": channel.is_active}


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
    return [
        {
            "id": c.id,
            "channel_type": c.channel_type,
            "short_code": c.short_code,
            "payhero_channel_id": c.payhero_channel_id,
            "is_active": c.is_active,
            "is_verified": c.is_verified,
        }
        for c in channels
    ]


@router.post("/initiate")
async def initiate_payment(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization=Depends(get_current_organization),
):
    # Resolve channel
    channel_id = payload.get("payhero_channel_id")
    if not channel_id:
        # use first active local channel
        result = await db.execute(
            select(TenantPaymentChannel).where(
                TenantPaymentChannel.organization_id == organization.id,
                TenantPaymentChannel.is_active == True,
            )
        )
        ch = result.scalars().first()
        if not ch:
            raise HTTPException(status_code=400, detail="No active payment channel configured for this organization")
        channel_id = ch.payhero_channel_id

    amount = payload.get("amount")
    phone_number = payload.get("phone_number")
    if not amount or not phone_number:
        raise HTTPException(status_code=422, detail="amount and phone_number are required")

    external_reference = payload.get("external_reference") or f"PH-{organization.id}-{int(datetime.utcnow().timestamp())}"

    transaction = PaymentTransaction(
        organization_id=organization.id,
        transaction_reference=external_reference,
        amount=amount,
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
            amount=int(amount),
            phone_number=phone_number,
            channel_id=int(channel_id),
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

    response = body.get("response", {}) if isinstance(body, dict) else {}
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
        # Try by external_reference column
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

    if result_code == 0 and status_str and status_str.lower() == "success":
        transaction.status = "completed"
        transaction.external_reference = mpesa_receipt or transaction.external_reference
        transaction.completed_at = datetime.utcnow()
        transaction.processed_at = datetime.utcnow()
        transaction.callback_data = body
        if amount:
            transaction.amount = amount
        await db.commit()
        logger.info("PayHero payment completed: %s", external_reference)
        # TODO: trigger subscription activation / invoice update in next stage
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
