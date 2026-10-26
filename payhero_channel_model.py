# PayHero Channel Model
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import BaseMixin


class PayHeroChannel(BaseMixin):
    __tablename__ = "payhero_channels"

    organization_id = Column(String, nullable=False, index=True)
    channel_id = Column(String, nullable=True, unique=True, index=True)
    channel_creation_id = Column(String, nullable=True, index=True)
    payment_method = Column(String, nullable=False)
    till_number = Column(String, nullable=True)
    paybill_number = Column(String, nullable=True)
    merchant_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_validated = Column(Boolean, default=False)
    validation_status = Column(String, default="pending")
    last_validated_at = Column(DateTime, nullable=True)
    validation_error = Column(String, nullable=True)
    sandbox_mode = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("organization_id", "payment_method", "till_number", name="uix_org_payment_till"),
        UniqueConstraint("organization_id", "payment_method", "paybill_number", name="uix_org_payment_pbill"),
    )

    def __repr__(self):
        return f"<PayHeroChannel org={self.organization_id} method={self.payment_method} channel={self.channel_id}>"