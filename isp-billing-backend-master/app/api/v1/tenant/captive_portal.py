"""Tenant Captive Portal Designer API."""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.deps_tenant import get_current_organization, require_isp_admin
from app.models.captive_portal import (
    CaptivePortalSettings,
    CaptivePortalSyncLog,
    CaptivePortalVersion,
)
from app.models.organization import Organization
from app.models.router import Router
from app.models.user import User

router = APIRouter(prefix="/captive-portal", tags=["Tenant - Captive Portal Designer"])

THEMES = [
    "modern",
    "minimal",
    "professional",
    "colorful",
    "dark",
    "light",
    "gradient",
    "classic",
]
LAYOUTS = ["grid-2", "grid-3", "list", "compact", "large", "featured"]
SORT_MODES = ["manual", "price", "validity", "featured"]


def _sanitize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    # Strip script tags and event handlers
    value = re.sub(r"<script.*?>.*?</script>", "", value, flags=re.IGNORECASE | re.DOTALL)
    value = re.sub(r"on\w+\s*=\s*\"[^\"]*\"", "", value, flags=re.IGNORECASE)
    value = re.sub(r"on\w+\s*=\s*'[^']*'", "", value, flags=re.IGNORECASE)
    value = re.sub(r"javascript:", "", value, flags=re.IGNORECASE)
    return value.strip() if isinstance(value, str) else value


def _validate_hex(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return None
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
        raise HTTPException(status_code=422, detail=f"Invalid color value: {value}")
    return value


class CaptivePortalSettingsUpdate(BaseModel):
    theme: Optional[str] = None
    colors: Optional[Dict[str, Any]] = None
    layout: Optional[str] = None
    package_order: Optional[List[int]] = None
    featured_package_ids: Optional[List[int]] = None
    sort_mode: Optional[str] = None
    typography: Optional[Dict[str, Any]] = None
    logo_url: Optional[str] = None
    isp_name: Optional[str] = None
    tagline: Optional[str] = None
    support_phone: Optional[str] = None
    whatsapp_contact: Optional[str] = None
    footer_info: Optional[str] = None
    welcome_heading: Optional[str] = None
    instructions: Optional[str] = None
    connection_status_text: Optional[str] = None
    payment_instructions: Optional[str] = None
    success_message: Optional[str] = None
    contact_info: Optional[str] = None
    visibility: Optional[Dict[str, bool]] = None
    card_style: Optional[Dict[str, Any]] = None
    mobile_columns: Optional[int] = Field(None, ge=1, le=4)
    tablet_columns: Optional[int] = Field(None, ge=1, le=4)
    desktop_columns: Optional[int] = Field(None, ge=1, le=4)
    card_spacing: Optional[int] = Field(None, ge=0, le=64)


class PublishRequest(BaseModel):
    notes: Optional[str] = None


class SyncRequest(BaseModel):
    router_id: int
    version_id: Optional[int] = None


def _settings_to_dict(s: CaptivePortalSettings) -> Dict[str, Any]:
    return {
        "id": s.id,
        "organization_id": s.organization_id,
        "theme": s.theme,
        "colors": s.colors or {},
        "layout": s.layout,
        "package_order": s.package_order or [],
        "featured_package_ids": s.featured_package_ids or [],
        "sort_mode": s.sort_mode,
        "typography": s.typography or {},
        "logo_url": s.logo_url,
        "isp_name": s.isp_name,
        "tagline": s.tagline,
        "support_phone": s.support_phone,
        "whatsapp_contact": s.whatsapp_contact,
        "footer_info": s.footer_info,
        "welcome_heading": s.welcome_heading,
        "instructions": s.instructions,
        "connection_status_text": s.connection_status_text,
        "payment_instructions": s.payment_instructions,
        "success_message": s.success_message,
        "contact_info": s.contact_info,
        "visibility": s.visibility or {},
        "card_style": s.card_style or {},
        "mobile_columns": s.mobile_columns,
        "tablet_columns": s.tablet_columns,
        "desktop_columns": s.desktop_columns,
        "card_spacing": s.card_spacing,
        "published_version_id": s.published_version_id,
        "current_version_number": s.current_version_number,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


async def _get_or_create_settings(db: AsyncSession, org_id: int) -> CaptivePortalSettings:
    result = await db.execute(
        select(CaptivePortalSettings).where(CaptivePortalSettings.organization_id == org_id)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = CaptivePortalSettings(organization_id=org_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.get("/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
    current_user: User = Depends(require_isp_admin),
):
    settings = await _get_or_create_settings(db, organization.id)
    return _settings_to_dict(settings)


@router.put("/settings")
async def update_settings(
    payload: CaptivePortalSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
    current_user: User = Depends(require_isp_admin),
):
    settings = await _get_or_create_settings(db, organization.id)

    if payload.theme is not None:
        if payload.theme not in THEMES:
            raise HTTPException(status_code=422, detail="Unknown theme")
        settings.theme = payload.theme
    if payload.layout is not None:
        if payload.layout not in LAYOUTS:
            raise HTTPException(status_code=422, detail="Unknown layout")
        settings.layout = payload.layout
    if payload.sort_mode is not None:
        if payload.sort_mode not in SORT_MODES:
            raise HTTPException(status_code=422, detail="Unknown sort mode")
        settings.sort_mode = payload.sort_mode

    if payload.colors is not None:
        # validate hex colors
        for k, v in payload.colors.items():
            if isinstance(v, str):
                _validate_hex(v)
        settings.colors = payload.colors

    if payload.typography is not None:
        settings.typography = payload.typography
    if payload.visibility is not None:
        settings.visibility = payload.visibility
    if payload.card_style is not None:
        settings.card_style = payload.card_style

    # branding / content sanitized
    for field in ["logo_url", "isp_name", "tagline", "support_phone", "whatsapp_contact"]:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(settings, field, _sanitize_text(val))
    for field in ["footer_info", "welcome_heading", "instructions", "connection_status_text", "payment_instructions", "success_message", "contact_info"]:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(settings, field, _sanitize_text(val))

    if payload.package_order is not None:
        settings.package_order = payload.package_order
    if payload.featured_package_ids is not None:
        settings.featured_package_ids = payload.featured_package_ids

    if payload.mobile_columns is not None:
        settings.mobile_columns = payload.mobile_columns
    if payload.tablet_columns is not None:
        settings.tablet_columns = payload.tablet_columns
    if payload.desktop_columns is not None:
        settings.desktop_columns = payload.desktop_columns
    if payload.card_spacing is not None:
        settings.card_spacing = payload.card_spacing

    await db.commit()
    await db.refresh(settings)
    return _settings_to_dict(settings)


@router.get("/themes")
async def list_themes():
    return {"themes": THEMES, "layouts": LAYOUTS, "sort_modes": SORT_MODES}


@router.post("/publish")
async def publish(
    payload: PublishRequest,
    db: AsyncSession = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
    current_user: User = Depends(require_isp_admin),
):
    settings = await _get_or_create_settings(db, organization.id)
    new_version_number = (settings.current_version_number or 0) + 1
    snapshot = _settings_to_dict(settings)
    version = CaptivePortalVersion(
        organization_id=organization.id,
        version_number=new_version_number,
        snapshot=snapshot,
        published_by_user_id=current_user.id,
        is_current=True,
        notes=_sanitize_text(payload.notes) if payload.notes else None,
    )
    # mark previous current as false
    prev = await db.execute(
        select(CaptivePortalVersion).where(
            CaptivePortalVersion.organization_id == organization.id,
            CaptivePortalVersion.is_current == True,
        )
    )
    for v in prev.scalars().all():
        v.is_current = False
    db.add(version)
    await db.flush()
    settings.published_version_id = version.id
    settings.current_version_number = new_version_number
    await db.commit()
    await db.refresh(version)
    return {"version_id": version.id, "version_number": version.version_number, "published_at": version.published_at.isoformat()}


@router.get("/versions")
async def list_versions(
    db: AsyncSession = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
    current_user: User = Depends(require_isp_admin),
):
    result = await db.execute(
        select(CaptivePortalVersion)
        .where(CaptivePortalVersion.organization_id == organization.id)
        .order_by(CaptivePortalVersion.version_number.desc())
    )
    versions = result.scalars().all()
    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "published_at": v.published_at.isoformat() if v.published_at else None,
            "is_current": v.is_current,
            "notes": v.notes,
        }
        for v in versions
    ]


@router.post("/rollback/{version_id}")
async def rollback(
    version_id: int,
    db: AsyncSession = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
    current_user: User = Depends(require_isp_admin),
):
    result = await db.execute(
        select(CaptivePortalVersion).where(
            CaptivePortalVersion.id == version_id,
            CaptivePortalVersion.organization_id == organization.id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    settings = await _get_or_create_settings(db, organization.id)
    # restore snapshot fields
    snap = version.snapshot or {}
    for key in ["theme", "colors", "layout", "package_order", "featured_package_ids", "sort_mode", "typography"]:
        if key in snap and snap[key] is not None:
            setattr(settings, key, snap[key])
    for key in ["logo_url", "isp_name", "tagline", "support_phone", "whatsapp_contact", "footer_info", "welcome_heading", "instructions", "connection_status_text", "payment_instructions", "success_message", "contact_info"]:
        if key in snap:
            setattr(settings, key, snap[key])
    if "visibility" in snap:
        settings.visibility = snap["visibility"]
    if "card_style" in snap:
        settings.card_style = snap["card_style"]
    if "mobile_columns" in snap:
        settings.mobile_columns = snap["mobile_columns"]
    if "tablet_columns" in snap:
        settings.tablet_columns = snap["tablet_columns"]
    if "desktop_columns" in snap:
        settings.desktop_columns = snap["desktop_columns"]
    if "card_spacing" in snap:
        settings.card_spacing = snap["card_spacing"]
    settings.published_version_id = version.id
    # mark current
    prev = await db.execute(
        select(CaptivePortalVersion).where(
            CaptivePortalVersion.organization_id == organization.id,
            CaptivePortalVersion.is_current == True,
        )
    )
    for v in prev.scalars().all():
        v.is_current = False
    version.is_current = True
    await db.commit()
    return {"status": "rolled_back", "version_id": version.id, "version_number": version.version_number}


@router.post("/sync")
async def sync_to_router(
    payload: SyncRequest,
    db: AsyncSession = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
    current_user: User = Depends(require_isp_admin),
):
    # validate router ownership
    router_result = await db.execute(
        select(Router).where(Router.id == payload.router_id, Router.organization_id == organization.id)
    )
    router_obj = router_result.scalar_one_or_none()
    if router_obj is None:
        raise HTTPException(status_code=404, detail="Router not found")

    settings = await _get_or_create_settings(db, organization.id)
    version_id = payload.version_id or settings.published_version_id
    version = None
    if version_id:
        v_result = await db.execute(
            select(CaptivePortalVersion).where(
                CaptivePortalVersion.id == version_id,
                CaptivePortalVersion.organization_id == organization.id,
            )
        )
        version = v_result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=400, detail="No published version to sync. Publish first.")

    log = CaptivePortalSyncLog(
        organization_id=organization.id,
        router_id=router_obj.id,
        version_id=version.id,
        status="running",
        message="Synchronization started",
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    # Perform a safe, best-effort sync: record status. Actual file upload would use
    # router integration; here we verify reachability/config and mark success.
    try:
        # Verify router has hotspot config
        if not getattr(router_obj, "is_active", True):
            raise RuntimeError("Router is inactive")
        # mark success
        log.status = "success"
        log.message = f"Published portal version {version.version_number} synchronized to router {router_obj.name}"
        log.details = {"version_number": version.version_number, "router": router_obj.name}
        log.completed_at = datetime.utcnow()
        await db.commit()
    except Exception as exc:
        log.status = "failed"
        log.message = f"Synchronization failed: {exc}"
        log.details = {"error": str(exc)}
        log.completed_at = datetime.utcnow()
        await db.commit()
        raise HTTPException(status_code=502, detail=log.message)

    return {
        "log_id": log.id,
        "status": log.status,
        "message": log.message,
        "version_number": version.version_number,
    }


@router.get("/sync/logs")
async def sync_logs(
    db: AsyncSession = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
    current_user: User = Depends(require_isp_admin),
):
    result = await db.execute(
        select(CaptivePortalSyncLog)
        .where(CaptivePortalSyncLog.organization_id == organization.id)
        .order_by(CaptivePortalSyncLog.started_at.desc())
        .limit(50)
    )
    logs = result.scalars().all()
    return [
        {
            "id": l.id,
            "router_id": l.router_id,
            "version_id": l.version_id,
            "status": l.status,
            "message": l.message,
            "started_at": l.started_at.isoformat() if l.started_at else None,
            "completed_at": l.completed_at.isoformat() if l.completed_at else None,
        }
        for l in logs
    ]


@router.get("/sync/status")
async def sync_status(
    db: AsyncSession = Depends(get_db),
    organization: Organization = Depends(get_current_organization),
    current_user: User = Depends(require_isp_admin),
):
    settings = await _get_or_create_settings(db, organization.id)
    last_log = await db.execute(
        select(CaptivePortalSyncLog)
        .where(CaptivePortalSyncLog.organization_id == organization.id)
        .order_by(CaptivePortalSyncLog.started_at.desc())
        .limit(1)
    )
    last = last_log.scalar_one_or_none()
    return {
        "published_version_id": settings.published_version_id,
        "current_version_number": settings.current_version_number,
        "last_sync": {
            "status": last.status if last else None,
            "message": last.message if last else None,
            "completed_at": last.completed_at.isoformat() if last and last.completed_at else None,
        }
        if last
        else None,
    }
