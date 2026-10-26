# PayHero Schemas
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
from datetime import datetime


class PayHeroConfig(BaseModel):
    organization_id: str = Field(..., description="Organization ID")
    payment_method: str = Field(..., description="Payment method (till, paybill, etc.)")
    till_number: Optional[str] = Field(None, description="Till number for till payments")
    paybill_number: Optional[str] = Field(None, description="PayBill number for paybill payments")
    merchant_id: Optional[str] = Field(None, description="Merchant ID")
    sandbox: bool = Field(True, description="Sandbox mode")
    api_key: str = Field(..., description="PayHero API key")
    username: str = Field(..., description="PayHero username")

    @validator("payment_method")
    def validate_payment_method(cls, v):
        allowed = ["till", "paybill"]
        if v not in allowed:
            raise ValueError(f"payment_method must be one of {allowed}")
        return v


class PayHeroChannelCreate(BaseModel):
    organization_id: str
    payment_method: str
    till_number: Optional[str] = None
    paybill_number: Optional[str] = None
    sandbox: bool = True


class PayHeroChannelResponse(BaseModel):
    id: str
    organization_id: str
    channel_id: str
    channel_creation_id: str
    payment_method: str
    till_number: Optional[str]
    paybill_number: Optional[str]
    merchant_id: Optional[str]
    is_active: bool
    is_validated: bool
    validation_status: str
    sandbox_mode: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PayHeroCallbackVerification(BaseModel):
    transaction_id: str
    organization_id: str
    status: Literal["pending", "completed", "failed"]
    amount: Optional[float] = None
    currency: Optional[str] = None
    payhero_reference: str
    timestamp: datetime

    @validator("status")
    def validate_status(cls, v):
        allowed = ["pending", "completed", "failed"]
        if v not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v


class PayHeroPaymentCreate(BaseModel):
    organization_id: str
    channel_id: str
    amount: float
    currency: str = "USD"
    description: str = ""
    reference: Optional[str] = None
    metadata: Optional[dict] = None

    @validator("amount")
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("amount must be positive")
        return v