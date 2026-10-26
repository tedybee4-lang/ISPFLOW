from fastapi import APIRouter, Depends, HTTPRequest, status
from typing import Optional
import logging

from app.schemas.payhero import (
    PayHeroConfig,
    PayHeroChannelCreate,
    PayHeroChannelResponse,
    PayHeroCallbackVerification,
    PayHeroPaymentCreate,
)
from app.services.payhero_service import PayHeroService
from app.models.payhero_channel import PayHeroChannel

router = APIRouter(prefix="/payhero", tags=["payhero"])
logger = logging.getLogger(__name__)


def get_payhero_service() -> PayHeroService:
    """Dependency to get PayHero service instance."""
    # In production, config would come from settings/environment
    from app.schemas.payhero import PayHeroConfig
    config = PayHeroConfig(
        organization_id="default",
        payment_method="till",
        sandbox=True,
        api_key="test-key",
        username="test-user",
    )
    return PayHeroService(config)


@router.post("/configure", response_model=PayHeroChannelResponse)
async def configure_channel(
    organization_id: str,
    payment_method: str,
    till_number: Optional[str] = None,
    paybill_number: Optional[str] = None,
    sandbox: bool = True,
    service: PayHeroService = Depends(get_payhero_service),
):
    """Configure or retrieve a PayHero channel for an organization."""
    channel_info = await service.create_channel_if_needed(
        organization_id, payment_method, till_number, paybill_number
    )
    return PayHeroChannelResponse(
        id=channel_info["channel_id"],
        organization_id=organization_id,
        channel_id=channel_info["channel_id"],
        channel_creation_id=channel_info["channel_creation_id"],
        payment_method=payment_method,
        till_number=till_number,
        paybill_number=paybill_number,
        is_active=True,
        is_validated=False,
        validation_status="pending",
        sandbox_mode=sandbox,
        created_at=None,
        updated_at=None,
    )


@router.post("/process-payment", response_model=dict)
async def process_payment(
    organization_id: str,
    amount: float,
    payment_method: str,
    currency: str = "USD",
    description: str = "",
    reference: Optional[str] = None,
    metadata: Optional[dict] = None,
    till_number: Optional[str] = None,
    paybill_number: Optional[str] = None,
    service: PayHeroService = Depends(get_payhero_service),
):
    """Process a payment through PayHero."""
    result = await service.process_payment(
        organization_id=organization_id,
        amount=amount,
        payment_method=payment_method,
        currency=currency,
        description=description,
        reference=reference,
        metadata=metadata,
        till_number=till_number,
        paybill_number=paybill_number,
    )
    return result


@router.post("/callback", response_model=dict)
async def verify_callback(
    payload: PayHeroCallbackVerification,
    service: PayHeroService = Depends(get_payhero_service),
):
    """Verify and process a PayHero webhook callback."""
    result = await service.verify_callback(payload.dict())
    return result


@router.get("/status/{channel_id}")
async def get_channel_status(
    channel_id: str,
    service: PayHeroService = Depends(get_payhero_service),
):
    """Get the status of a PayHero channel."""
    base_url = "https://sandbox-api.payhero.io" if service._is_sandbox() else "https://api.payhero.io"
    async with aiohttp.ClientSession() as session:
        headers = service._get_headers()
        async with session.get(
            f"{base_url}/channels/{channel_id}/status",
            headers=headers,
        ) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise HTTPException(status_code=resp.status, detail=text)
            return await resp.json()