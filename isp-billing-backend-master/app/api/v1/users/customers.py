"""ISP Customer users API endpoints."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_outlet_id,
    get_pagination_params,
    PaginationParams,
    require_admin,
    require_technician_or_admin,
)
from app.core.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.core.security import get_password_hash
from app.api.deps_org import get_org_id_for_query
from app.schemas.user import User as UserSchema
from app.modules.auth import UserService

router = APIRouter()


class CustomerCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    email: EmailStr
    password: str = Field(..., min_length=12, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    phone: Optional[str] = Field(None, min_length=8, max_length=20, pattern=r"^\+?[1-9]\d{7,14}$")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if not any(char.islower() for char in value) or not any(char.isupper() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("Password must include uppercase, lowercase, and numeric characters")
        return value


@router.get("/", response_model=Dict[str, Any])
async def get_customer_users(
    pagination: PaginationParams = Depends(get_pagination_params),
    status: Optional[UserStatus] = Query(None, description="Filter by user status"),
    search: Optional[str] = Query(None, description="Search in username, email, or name"),
    organization_id: Optional[int] = Query(None, description="Filter by organization (platform owners only)"),
    current_user: User = Depends(require_technician_or_admin()),
    outlet_id: Optional[int] = Depends(get_outlet_id),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Get ISP customer users.

    Platform owners can optionally filter by organization_id.
    ISP staff are automatically scoped to their own organization.

    Phase 5 (ADDITIVE): when an ``X-Outlet-ID`` header is present it further
    scopes results to that outlet. Optional — omitting it preserves the existing
    org-wide behavior exactly.
    """
    user_service = UserService(db)

    # ISP staff scoped to their org; platform owners can specify or see all
    org_id = organization_id
    if current_user.role != UserRole.PLATFORM_OWNER:
        org_id = current_user.organization_id

    result = await user_service.get_customer_users(
        organization_id=org_id,
        page=pagination.page,
        size=pagination.size,
        status=status,
        search=search,
        outlet_id=outlet_id,
    )

    result["users"] = [UserSchema.model_validate(u) for u in result["users"]]
    return result


@router.post("/", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_customer_user(
    customer_data: CustomerCreate,
    org_id: int = Depends(get_org_id_for_query),
    current_user: User = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
) -> UserSchema:
    """Create a tenant customer account; staff cannot assign administrative roles."""
    if current_user.role != UserRole.PLATFORM_OWNER and current_user.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create customers in this organization",
        )

    for field, value in (
        (User.username, customer_data.username),
        (User.email, str(customer_data.email).lower()),
    ):
        existing = await db.execute(select(User.id).where(field == value))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this username or email already exists",
            )
    phone = customer_data.phone.strip() if customer_data.phone else None
    if phone:
        existing = await db.execute(select(User.id).where(User.phone == phone))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this phone number already exists",
            )

    customer = User(
        organization_id=org_id,
        username=customer_data.username.strip(),
        email=str(customer_data.email).lower(),
        phone=phone,
        first_name=customer_data.first_name.strip(),
        last_name=customer_data.last_name.strip(),
        hashed_password=get_password_hash(customer_data.password),
        role=UserRole.CUSTOMER,
        status=UserStatus.PENDING_VERIFICATION,
        is_active=True,
        is_verified=False,
        email_verified_at=None,
    )
    db.add(customer)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with these unique details already exists",
        ) from exc
    await db.refresh(customer)
    return UserSchema.model_validate(customer)
