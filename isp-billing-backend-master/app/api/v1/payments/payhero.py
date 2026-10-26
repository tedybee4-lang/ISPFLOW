"""Tenant-isolated PayHero channel configuration and payment routes."""

import logging
import re
import uuid
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.api.deps_tenant import get_current_organization, require_isp_admin
from app.core.config import settings
from app.core.exceptions import ConfigurationError
from app.core.encryption import decrypt_value, encrypt_value
from app.integrations.payhero import PayHeroClient
from app.models.billing import Invoice, InvoiceStatus, Payment, PaymentMethod, PaymentStatus
from app.models.organization import Organization
from app.models.payment_gateway import PaymentTransaction, TenantPaymentChannel
from app.models.plan import PlanStatus, ServicePlan
from app.models.subscription import Subscription
from app.models.user import User, UserRole
from app.modules.billing.service import BillingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payhero", tags=["payhero"])
_ENCRYPTED_TOKEN_PREFIX = "enc:v1:"
_CHANNEL_TYPES = {"till", "paybill", "bank"}


def _optional_id(value: Any, field_name: str) -> Optional[int]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise HTTPException(status_code=422, detail=f"{field_name} must be a positive integer.")
    try:
        identifier = int(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"{field_name} must be a positive integer.")
    if identifier <= 0:
        raise HTTPException(status_code=422, detail=f"{field_name} must be a positive integer.")
    return identifier


def _channel_status_payload(channel: TenantPaymentChannel) -> dict[str, Any]:
    return {
        "channel_type": channel.channel_type,
        "short_code": channel.short_code,
        "account_number": channel.account_number,
        "description": channel.description,
        "is_active": channel.is_active,
        "is_verified": channel.is_verified,
        "status": channel.status or "not_configured",
        "last_error": channel.last_error,
        "has_credentials": bool(channel.api_token_encrypted),
    }


def _get_channel_client(channel: TenantPaymentChannel) -> PayHeroClient:
    encrypted_token = channel.api_token_encrypted
    if not encrypted_token or not channel.payhero_account_id:
        raise HTTPException(
            status_code=409,
            detail="PayHero configuration is incomplete. Add the merchant credentials and account ID.",
        )
    try:
        token = decrypt_value(encrypted_token.removeprefix(_ENCRYPTED_TOKEN_PREFIX))
    except ValueError as exc:
        logger.error("Could not decrypt PayHero credentials for channel %s", channel.id)
        raise HTTPException(
            status_code=503,
            detail="Stored PayHero credentials cannot be read. Re-enter the credentials and save again.",
        ) from exc
    return PayHeroClient(authorization_token=token, account_id=channel.payhero_account_id)


def _as_provider_channels(remote: dict[str, Any]) -> tuple[list[dict[str, Any]], Any]:
    records = remote.get("payment_channels")
    pagination = remote.get("pagination")
    if (
        not isinstance(records, list)
        or not isinstance(pagination, dict)
        or "next_page" not in pagination
    ):
        raise HTTPException(
            status_code=502,
            detail="PayHero returned an unexpected payment-channel response.",
        )
    return [item for item in records if isinstance(item, dict)], pagination


async def _find_registered_channel(
    client: PayHeroClient,
    account_id: int,
    channel_type: str,
    short_code: str,
    account_number: str,
) -> tuple[Optional[dict[str, Any]], bool]:
    page = 1
    same_shortcode_different_details = False

    for _ in range(100):
        remote = await client.list_payment_channels(page=page)
        channels, pagination = _as_provider_channels(remote)
        for item in channels:
            if (
                str(item.get("account_id")) != str(account_id)
                or str(item.get("short_code", "")).strip() != short_code
                or str(item.get("channel_type", "")).strip().lower() != channel_type
            ):
                continue
            if str(item.get("account_number") or "").strip() == account_number:
                return item, same_shortcode_different_details
            same_shortcode_different_details = True

        next_page = pagination["next_page"]
        if next_page is None:
            break
        if not isinstance(next_page, int) or next_page <= page:
            raise HTTPException(
                status_code=502,
                detail="PayHero returned invalid channel-list pagination; no channel was created.",
            )
        page = next_page
    else:
        raise HTTPException(
            status_code=502,
            detail="PayHero channel list is too large to verify safely; no channel was created.",
        )

    return None, same_shortcode_different_details


def _set_channel_result(
    channel: TenantPaymentChannel,
    remote: dict[str, Any],
) -> bool:
    remote_id = remote.get("id")
    try:
        channel_id = int(remote_id)
    except (TypeError, ValueError):
        channel_id = 0

    if channel_id <= 0:
        channel.status = "failed"
        channel.last_error = "PayHero did not return a valid channel identifier."
        channel.is_active = False
        channel.is_verified = False
        return False

    channel.payhero_channel_id = channel_id
    channel.is_active = remote.get("is_active") is True
    channel.is_verified = channel.is_active
    channel.status = "active" if channel.is_active else "requires_attention"
    channel.last_error = None if channel.is_active else "PayHero has not confirmed this channel as active."
    return channel.is_active


async def _tenant_channel_list(
    db: AsyncSession,
    organization: Organization,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(TenantPaymentChannel)
        .where(TenantPaymentChannel.organization_id == organization.id)
        .order_by(TenantPaymentChannel.id)
    )
    return [_channel_status_payload(channel) for channel in result.scalars().all()]


@router.get("/channels")
@router.get("/channels/local")
async def list_payment_channels(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_isp_admin),
    organization: Organization = Depends(get_current_organization),
):
    return await _tenant_channel_list(db, organization)


@router.post("/channels")
async def register_payment_channel(
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_isp_admin),
    organization: Organization = Depends(get_current_organization),
):
    channel_type = str(payload.get("channel_type", "")).strip().lower()
    short_code = str(payload.get("short_code", "")).strip()
    account_number = str(payload.get("account_number") or "").strip()
    description = str(payload.get("description") or "").strip()
    raw_account_id = payload.get("account_id")
    api_token = str(payload.get("api_token") or "").strip()
    if api_token.lower().startswith("basic "):
        api_token = api_token[6:].strip()
    elif api_token.lower() == "basic":
        api_token = ""

    if channel_type not in _CHANNEL_TYPES:
        raise HTTPException(status_code=422, detail="Choose Till, PayBill, or Bank.")
    if not short_code or len(short_code) > 20:
        raise HTTPException(status_code=422, detail="A valid Till, PayBill, or bank shortcode is required.")
    if not account_number:
        raise HTTPException(status_code=422, detail="The PayHero merchant account number is required.")
    if len(account_number) > 50 or len(description) > 200:
        raise HTTPException(status_code=422, detail="Payment channel details exceed the supported length.")
    account_id = _optional_id(raw_account_id, "PayHero account ID")

    # Serialize setup attempts for a tenant so a network retry cannot race a second
    # channel creation for the same shortcode.
    await db.execute(
        select(Organization.id)
        .where(Organization.id == organization.id)
        .with_for_update()
    )
    existing_result = await db.execute(
        select(TenantPaymentChannel)
        .where(
            TenantPaymentChannel.organization_id == organization.id,
            TenantPaymentChannel.channel_type == channel_type,
            TenantPaymentChannel.short_code == short_code,
        )
        .order_by(TenantPaymentChannel.id)
        .limit(1)
    )
    channel = existing_result.scalar_one_or_none()
    if account_id is None and channel is not None:
        account_id = channel.payhero_account_id
    if account_id is None:
        raise HTTPException(status_code=422, detail="PayHero account ID is required.")
    if (
        channel is not None
        and channel.status == "channel_creation_pending"
        and channel.updated_at is not None
        and channel.updated_at >= datetime.utcnow() - timedelta(minutes=5)
    ):
        raise HTTPException(
            status_code=409,
            detail="PayHero channel setup is already in progress. Retry after a few minutes.",
        )
    if channel is None:
        channel = TenantPaymentChannel(
            organization_id=organization.id,
            channel_type=channel_type,
            short_code=short_code,
            is_active=False,
            is_verified=False,
            status="configuration_incomplete",
        )
        db.add(channel)

    if api_token:
        try:
            encrypted_token = encrypt_value(api_token)
        except ConfigurationError as exc:
            logger.error("PayHero credentials could not be encrypted for organization %s", organization.id)
            raise HTTPException(
                status_code=503,
                detail="ISPFlow cannot securely store PayHero credentials. Contact support before retrying.",
            ) from exc
        channel.api_token_encrypted = _ENCRYPTED_TOKEN_PREFIX + encrypted_token
    if not channel.api_token_encrypted:
        raise HTTPException(status_code=422, detail="PayHero Basic Auth credentials are required.")

    channel.channel_type = channel_type
    channel.short_code = short_code
    channel.account_number = account_number or None
    channel.description = description or f"{channel_type.title()} {short_code}"
    channel.payhero_account_id = account_id
    channel.status = "validating"
    channel.last_error = None
    channel.is_active = False
    channel.is_verified = False
    await db.flush()
    client = _get_channel_client(channel)
    channel.status = "channel_creation_pending"
    await db.commit()

    try:
        existing_remote, mismatched_details = await _find_registered_channel(
            client,
            account_id,
            channel_type,
            short_code,
            account_number,
        )
        if existing_remote is not None:
            _set_channel_result(channel, existing_remote)
        elif mismatched_details:
            channel.status = "requires_attention"
            channel.last_error = (
                "A PayHero channel with this shortcode already exists but its account details differ. "
                "Review it in PayHero before retrying."
            )
        else:
            created = await client.register_payment_channel(
                channel_type=channel_type,
                short_code=short_code,
                account_number=account_number,
                description=channel.description or f"{channel_type.title()} {short_code}",
            )
            _set_channel_result(channel, created)
    except httpx.HTTPError:
        channel.status = "failed"
        channel.last_error = "PayHero could not validate or register the channel. Check credentials and retry."
        channel.is_active = False
        channel.is_verified = False
        await db.commit()
        logger.warning("PayHero channel registration failed for organization %s", organization.id)
        raise HTTPException(status_code=502, detail=channel.last_error)
    except HTTPException as exc:
        channel.status = "failed"
        channel.last_error = str(exc.detail)
        channel.is_active = False
        channel.is_verified = False
        await db.commit()
        raise
    except (ValueError, TypeError):
        channel.status = "failed"
        channel.last_error = "PayHero returned an invalid channel response."
        channel.is_active = False
        channel.is_verified = False
        await db.commit()
        logger.warning("PayHero returned invalid channel data for organization %s", organization.id)
        raise HTTPException(status_code=502, detail=channel.last_error)

    await db.commit()
    await db.refresh(channel)
    if channel.status == "requires_attention":
        raise HTTPException(status_code=409, detail=channel.last_error)
    if channel.status == "failed":
        raise HTTPException(status_code=502, detail=channel.last_error)
    return _channel_status_payload(channel)


@router.post("/initiate")
async def initiate_payment(
    payload: dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization: Organization = Depends(get_current_organization),
):
    channel_result = await db.execute(
        select(TenantPaymentChannel)
        .where(
            TenantPaymentChannel.organization_id == organization.id,
            TenantPaymentChannel.is_active.is_(True),
            TenantPaymentChannel.is_verified.is_(True),
            TenantPaymentChannel.payhero_channel_id.is_not(None),
        )
        .order_by(TenantPaymentChannel.id)
        .limit(1)
    )
    channel = channel_result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=409, detail="No active PayHero channel is configured for this ISP.")

    try:
        amount = Decimal(str(payload.get("amount")))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=422, detail="A valid payment amount is required.")
    if not amount.is_finite() or amount <= 0 or amount != amount.to_integral_value():
        raise HTTPException(status_code=422, detail="PayHero payments must use a positive whole-number KES amount.")

    phone_number = str(payload.get("phone_number") or "").strip()
    if not re.fullmatch(r"\+?[0-9]{9,15}", phone_number):
        raise HTTPException(status_code=422, detail="Enter a valid customer phone number.")

    payer_id = (
        current_user.id
        if current_user.role == UserRole.CUSTOMER
        else payload.get("user_id", current_user.id)
    )
    if isinstance(payer_id, bool):
        raise HTTPException(status_code=422, detail="A valid customer is required.")
    try:
        payer_id = int(payer_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="A valid customer is required.")
    user_result = await db.execute(
        select(User).where(
            User.id == payer_id,
            User.organization_id == organization.id,
        )
    )
    payer = user_result.scalar_one_or_none()
    if payer is None:
        raise HTTPException(status_code=404, detail="Customer not found for this ISP.")

    invoice_id = _optional_id(payload.get("invoice_id"), "invoice_id")
    invoice = None
    if invoice_id is not None:
        invoice_result = await db.execute(
            select(Invoice).where(
                Invoice.id == invoice_id,
                Invoice.organization_id == organization.id,
                Invoice.user_id == payer.id,
            )
        )
        invoice = invoice_result.scalar_one_or_none()
        if invoice is None:
            raise HTTPException(status_code=404, detail="Invoice not found for this customer and ISP.")
        if invoice.currency != "KES" or invoice.status not in {
            InvoiceStatus.PENDING,
            InvoiceStatus.OVERDUE,
        } or invoice.balance <= 0:
            raise HTTPException(status_code=409, detail="This invoice is not payable through PayHero.")
        if amount > invoice.balance:
            raise HTTPException(
                status_code=422,
                detail="Payment amount cannot exceed the invoice balance.",
            )

    subscription_id = _optional_id(payload.get("subscription_id"), "subscription_id")
    if subscription_id is not None:
        subscription_result = await db.execute(
            select(Subscription).where(
                Subscription.id == subscription_id,
                Subscription.organization_id == organization.id,
                Subscription.user_id == payer.id,
            )
        )
        subscription = subscription_result.scalar_one_or_none()
        if subscription is None:
            raise HTTPException(status_code=404, detail="Subscription not found for this customer and ISP.")
        if invoice is None:
            plan_result = await db.execute(
                select(ServicePlan).where(
                    ServicePlan.id == subscription.plan_id,
                    ServicePlan.organization_id == organization.id,
                )
            )
            plan = plan_result.scalar_one_or_none()
            if plan is None:
                raise HTTPException(status_code=404, detail="Subscription plan not found for this ISP.")
            if plan.status != PlanStatus.ACTIVE or plan.currency != "KES" or amount != plan.price:
                raise HTTPException(
                    status_code=422,
                    detail="Subscription payments must match the active plan price in KES.",
                )

    client = _get_channel_client(channel)
    external_reference = f"PH-{organization.id}-{uuid.uuid4().hex}"
    transaction = PaymentTransaction(
        organization_id=organization.id,
        tenant_payment_channel_id=channel.id,
        transaction_reference=external_reference,
        amount=amount,
        currency="KES",
        transaction_type="payment",
        status="pending",
        phone_number=phone_number,
        account_reference=payload.get("account_reference"),
        invoice_id=invoice_id,
        subscription_id=subscription_id,
        user_id=payer.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    callback_url = settings.payhero_callback_url or (
        f"{settings.backend_url or ''}/api/v1/payhero/callback"
    )
    try:
        remote = await client.initiate_stk_push(
            amount=int(amount),
            phone_number=phone_number,
            channel_id=int(channel.payhero_channel_id),
            external_reference=external_reference,
            customer_name=payload.get("customer_name"),
            callback_url=callback_url,
        )
    except httpx.HTTPError as exc:
        transaction.status = "failed"
        transaction.status_message = "PayHero could not start the payment. Please retry."
        await db.commit()
        logger.warning("PayHero payment initiation failed for organization %s", organization.id)
        raise HTTPException(status_code=502, detail=transaction.status_message) from exc

    transaction.extra_data = {
        "payhero_reference": remote.get("reference"),
        "checkout_request_id": remote.get("CheckoutRequestID"),
    }
    if not remote.get("success") or not remote.get("reference") or not remote.get("CheckoutRequestID"):
        transaction.status = "failed"
        transaction.status_message = "PayHero did not confirm that the payment request was queued."
        await db.commit()
        raise HTTPException(status_code=502, detail=transaction.status_message)

    await db.commit()
    return {
        "success": True,
        "status": remote.get("status"),
        "transaction_reference": external_reference,
        "checkout_request_id": remote.get("CheckoutRequestID"),
    }


def _normalize_phone(value: Any) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits[-9:]


@router.post("/callback")
async def payment_callback(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        body = await request.json()
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.") from exc
    if not isinstance(body, dict) or not isinstance(body.get("response"), dict):
        raise HTTPException(status_code=400, detail="Invalid PayHero callback payload.")

    callback = body["response"]
    external_reference = callback.get("ExternalReference")
    if not external_reference:
        raise HTTPException(status_code=400, detail="Missing payment reference.")

    transaction_result = await db.execute(
        select(PaymentTransaction)
        .where(PaymentTransaction.transaction_reference == str(external_reference))
        .with_for_update()
    )
    transaction = transaction_result.scalar_one_or_none()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Payment reference not found.")
    if transaction.status == "completed":
        return {"status": "already_processed"}
    if not transaction.tenant_payment_channel_id:
        raise HTTPException(status_code=409, detail="Payment is not linked to a tenant PayHero channel.")

    channel_result = await db.execute(
        select(TenantPaymentChannel).where(
            TenantPaymentChannel.id == transaction.tenant_payment_channel_id,
            TenantPaymentChannel.organization_id == transaction.organization_id,
        )
    )
    channel = channel_result.scalar_one_or_none()
    if channel is None:
        raise HTTPException(status_code=409, detail="The payment's tenant channel is unavailable.")

    metadata = transaction.extra_data if isinstance(transaction.extra_data, dict) else {}
    expected_checkout_id = metadata.get("checkout_request_id")
    payhero_reference = metadata.get("payhero_reference")
    if (
        not expected_checkout_id
        or not payhero_reference
        or callback.get("CheckoutRequestID") != expected_checkout_id
    ):
        raise HTTPException(status_code=400, detail="PayHero callback does not match the initiated payment.")

    try:
        callback_amount = Decimal(str(callback.get("Amount")))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="PayHero callback is missing a valid amount.")
    if callback_amount != transaction.amount:
        raise HTTPException(status_code=400, detail="PayHero callback amount does not match the payment.")
    if _normalize_phone(callback.get("Phone")) != _normalize_phone(transaction.phone_number):
        raise HTTPException(status_code=400, detail="PayHero callback phone does not match the payment.")

    client = _get_channel_client(channel)
    try:
        verified = await client.get_transaction_status(str(payhero_reference))
    except httpx.HTTPError as exc:
        logger.warning("PayHero status verification unavailable for organization %s", transaction.organization_id)
        raise HTTPException(status_code=503, detail="PayHero could not verify this payment yet. Retry the callback.") from exc

    provider_status = str(verified.get("status") or "").upper()
    verified_reference = verified.get("reference")
    if verified_reference and str(verified_reference) != str(payhero_reference):
        raise HTTPException(status_code=400, detail="PayHero status response does not match the payment.")
    remote_amount = verified.get("amount")
    if remote_amount is not None:
        try:
            if Decimal(str(remote_amount)) != transaction.amount:
                raise HTTPException(status_code=400, detail="PayHero verified amount does not match the payment.")
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="PayHero returned an invalid verified amount.") from exc

    callback_success = (
        callback.get("ResultCode") == 0
        and str(callback.get("Status") or "").lower() == "success"
        and body.get("status") is True
    )
    if provider_status in {"FAILED", "CANCELLED"} and not callback_success:
        transaction.status = "failed"
        transaction.status_message = "PayHero confirmed that the payment failed."
        transaction.callback_data = body
        transaction.processed_at = datetime.utcnow()
        await db.commit()
        return {"status": "failed"}
    if not callback_success or provider_status != "SUCCESS":
        raise HTTPException(status_code=409, detail="PayHero has not confirmed this payment as successful.")

    receipt_reference = str(callback.get("MpesaReceiptNumber") or "").strip()
    if not receipt_reference:
        raise HTTPException(status_code=400, detail="PayHero callback is missing the payment receipt.")

    existing_by_reference = await db.execute(
        select(Payment).where(Payment.reference_number == receipt_reference)
    )
    prior_payment = existing_by_reference.scalar_one_or_none()
    if prior_payment and prior_payment.transaction_id != transaction.transaction_reference:
        raise HTTPException(status_code=409, detail="This PayHero receipt is already linked to another payment.")

    billing = BillingService(db, organization_id=transaction.organization_id)
    payment = prior_payment
    if payment is None:
        existing_by_transaction = await db.execute(
            select(Payment).where(
                Payment.transaction_id == transaction.transaction_reference,
                Payment.organization_id == transaction.organization_id,
            )
        )
        payment = existing_by_transaction.scalar_one_or_none()

    if payment is None:
        payment = Payment(
            organization_id=transaction.organization_id,
            user_id=transaction.user_id,
            invoice_id=transaction.invoice_id,
            payment_number=await billing._generate_payment_number(),
            amount=transaction.amount,
            currency=transaction.currency or "KES",
            payment_method=PaymentMethod.MPESA,
            status=PaymentStatus.COMPLETED,
            transaction_id=transaction.transaction_reference,
            reference_number=receipt_reference,
            notes=f"PayHero payment {external_reference}",
            payment_date=datetime.utcnow(),
            processed_date=datetime.utcnow(),
        )
        db.add(payment)

    transaction.external_reference = receipt_reference
    transaction.completed_at = datetime.utcnow()
    transaction.processed_at = datetime.utcnow()
    transaction.callback_data = body
    transaction.status = "completed"
    await db.commit()

    if transaction.invoice_id:
        await billing._apply_payment_to_invoice(transaction.invoice_id, transaction.amount)
    if transaction.subscription_id:
        await billing._activate_subscription_on_payment(transaction.subscription_id)

    logger.info("PayHero payment verified and processed for organization %s", transaction.organization_id)
    return {"status": "received"}


@router.get("/status/{reference}")
async def get_payment_status(
    reference: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization: Organization = Depends(get_current_organization),
):
    result = await db.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.transaction_reference == reference,
            PaymentTransaction.organization_id == organization.id,
        )
    )
    transaction = result.scalar_one_or_none()
    if transaction is None:
        raise HTTPException(status_code=404, detail="Payment not found for this ISP.")
    if (
        current_user.role not in {UserRole.ISP_ADMIN, UserRole.PLATFORM_OWNER}
        and transaction.user_id != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Payment not found for this ISP.")
    return {
        "reference": transaction.transaction_reference,
        "status": transaction.status,
        "amount": str(transaction.amount),
        "currency": transaction.currency,
        "processed_at": transaction.processed_at,
    }
