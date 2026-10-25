"""Security utilities for authentication and authorization."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

import jwt
from jwt.exceptions import InvalidTokenError
import bcrypt
from pydantic import BaseModel

from app.core.config import settings


class TokenData(BaseModel):
    """Token data model."""

    user_id: Optional[int] = None
    username: Optional[str] = None
    role: Optional[str] = None
    organization_id: Optional[int] = None
    capability: Optional[str] = None
    router_id: Optional[int] = None
    router_action: Optional[str] = None
    resource_id: Optional[int] = None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash using bcrypt directly."""
    try:
        # Convert to bytes
        password_bytes = plain_password.encode('utf-8')
        hash_bytes = hashed_password.encode('utf-8') if isinstance(hashed_password, str) else hashed_password
        
        # Verify using bcrypt
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Password verification error: {str(e)}")
        return False


def get_password_hash(password: str) -> str:
    """Generate password hash using bcrypt directly."""
    try:
        # Convert to bytes
        password_bytes = password.encode('utf-8')
        
        # Generate salt and hash
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password_bytes, salt)
        
        # Return as string
        return hashed.decode('utf-8')
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Password hashing error: {str(e)}")
        raise


def create_access_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(
        to_encode, settings.secret_key, algorithm=settings.algorithm
    )
    return encoded_jwt


def create_refresh_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT refresh token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(
        to_encode, settings.secret_key, algorithm=settings.algorithm
    )
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> Optional[TokenData]:
    """Verify and decode JWT token."""
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        if payload.get("type") != token_type:
            return None
        user_id_str: str = payload.get("sub")
        username: str = payload.get("username")
        role: str = payload.get("role")
        organization_id = payload.get("organization_id")
        if user_id_str is None or username is None:
            return None
        try:
            user_id = int(user_id_str)
        except (TypeError, ValueError):
            return None
        return TokenData(
            user_id=user_id,
            username=username,
            role=role,
            organization_id=organization_id,
            capability=payload.get("capability"),
            router_id=payload.get("router_id"),
            router_action=payload.get("router_action"),
            resource_id=payload.get("resource_id"),
        )
    except InvalidTokenError:
        return None


def create_router_capability_token(
    *,
    capability: str,
    router_id: int,
    organization_id: Optional[int],
    router_action: Optional[str] = None,
    resource_id: Optional[int] = None,
    parameters: Optional[Dict[str, Any]] = None,
    expires_delta: timedelta = timedelta(minutes=5),
) -> str:
    """Create a short-lived token restricted to a single router operation."""
    if capability not in {"router_action", "router_backup_upload"}:
        raise ValueError("Unsupported router capability")
    return create_access_token(
        {
            "sub": f"router:{router_id}",
            "capability": capability,
            "router_id": router_id,
            "organization_id": organization_id,
            "router_action": router_action,
            "resource_id": resource_id,
            "parameters": parameters or {},
        },
        expires_delta=expires_delta,
    )


def verify_router_capability_token(
    token: str,
    *,
    capability: str,
) -> Optional[Dict[str, Any]]:
    """Decode a short-lived router capability without treating it as a user JWT."""
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except InvalidTokenError:
        return None

    if payload.get("type") != "access" or payload.get("capability") != capability:
        return None
    return payload


def create_token_pair(
    user_id: int,
    username: str,
    role: str,
    organization_id: Optional[int] = None
) -> Dict[str, str]:
    """Create both access and refresh tokens."""
    token_data = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "organization_id": organization_id,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


# create_2fa_challenge_token was removed with the local 2FA flow — 2FA is now
# handled centrally by the SSO IdP (auth-api).
