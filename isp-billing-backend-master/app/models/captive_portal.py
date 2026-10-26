"""Captive portal customization, versioning, and MikroTik sync models."""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class CaptivePortalSettings(Base):
    """Tenant-specific captive portal design settings (draft)."""

    __tablename__ = "captive_portal_settings"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), unique=True, nullable=False, index=True)

    # Theme
    theme = Column(String(50), default="modern", nullable=False)

    # Colors (JSON object)
    colors = Column(JSON, nullable=True)

    # Layout
    layout = Column(String(50), default="grid-3", nullable=False)

    # Package ordering
    package_order = Column(JSON, nullable=True)  # list of plan ids
    featured_package_ids = Column(JSON, nullable=True)
    sort_mode = Column(String(30), default="manual", nullable=False)

    # Typography
    typography = Column(JSON, nullable=True)

    # Branding
    logo_url = Column(String(500), nullable=True)
    isp_name = Column(String(200), nullable=True)
    tagline = Column(String(300), nullable=True)
    support_phone = Column(String(50), nullable=True)
    whatsapp_contact = Column(String(50), nullable=True)
    footer_info = Column(Text, nullable=True)

    # Portal content
    welcome_heading = Column(String(200), nullable=True)
    instructions = Column(Text, nullable=True)
    connection_status_text = Column(String(200), nullable=True)
    payment_instructions = Column(Text, nullable=True)
    success_message = Column(String(300), nullable=True)
    contact_info = Column(Text, nullable=True)

    # Visibility flags (JSON)
    visibility = Column(JSON, nullable=True)

    # Card styling
    card_style = Column(JSON, nullable=True)

    # Mobile responsiveness (columns per breakpoint)
    mobile_columns = Column(Integer, default=1, nullable=False)
    tablet_columns = Column(Integer, default=2, nullable=False)
    desktop_columns = Column(Integer, default=3, nullable=False)
    card_spacing = Column(Integer, default=16, nullable=False)

    # Published state
    published_version_id = Column(Integer, nullable=True)
    current_version_number = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", backref="captive_portal_settings")


class CaptivePortalVersion(Base):
    """A published snapshot of portal settings."""

    __tablename__ = "captive_portal_versions"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    snapshot = Column(JSON, nullable=False)
    published_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    published_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_current = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("organization_id", "version_number", name="uq_org_portal_version"),
    )

    organization = relationship("Organization", backref="captive_portal_versions")


class CaptivePortalSyncLog(Base):
    """Router synchronization log for captive portal deployment."""

    __tablename__ = "captive_portal_sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    router_id = Column(Integer, ForeignKey("routers.id"), nullable=True, index=True)
    version_id = Column(Integer, ForeignKey("captive_portal_versions.id"), nullable=True, index=True)
    status = Column(String(30), default="pending", nullable=False)  # pending, running, success, failed, rolled_back
    message = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    rolled_back_from_version_id = Column(Integer, nullable=True)

    organization = relationship("Organization", backref="captive_portal_sync_logs")
    router = relationship("Router", backref="captive_portal_sync_logs")
    version = relationship("CaptivePortalVersion", backref="sync_logs")
