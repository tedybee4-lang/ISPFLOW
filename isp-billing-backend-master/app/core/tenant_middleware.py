"""Tenant middleware for public-portal tenant resolution."""

import contextvars
from typing import Optional, TYPE_CHECKING
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

if TYPE_CHECKING:
    from app.models.organization import Organization

# Context variable to store current tenant
_current_tenant: contextvars.ContextVar[Optional["Organization"]] = contextvars.ContextVar(
    "current_tenant", default=None
)
_current_organization_id: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "current_organization_id", default=None
)


def get_current_tenant() -> Optional["Organization"]:
    """Get the current tenant from context."""
    return _current_tenant.get()


def get_current_organization_id() -> Optional[int]:
    """Get the current organization ID from context."""
    return _current_organization_id.get()


def set_current_tenant(tenant: Optional["Organization"]) -> None:
    """Set the current tenant in context."""
    _current_tenant.set(tenant)
    if tenant:
        _current_organization_id.set(tenant.id)
    else:
        _current_organization_id.set(None)


def set_current_organization_id(organization_id: Optional[int]) -> None:
    """Set the current organization ID in context."""
    _current_organization_id.set(organization_id)


class TenantContext:
    """
    Tenant context manager for explicit tenant setting.

    Usage:
        async with TenantContext(organization_id=1):
            # All queries within this block will be scoped to org 1
            users = await user_service.get_all()
    """

    def __init__(
        self,
        organization_id: Optional[int] = None,
        tenant: Optional["Organization"] = None
    ):
        self.organization_id = organization_id
        self.tenant = tenant
        self._token_id: Optional[contextvars.Token] = None
        self._token_tenant: Optional[contextvars.Token] = None

    def __enter__(self):
        if self.organization_id is not None:
            self._token_id = _current_organization_id.set(self.organization_id)
        if self.tenant is not None:
            self._token_tenant = _current_tenant.set(self.tenant)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._token_id is not None:
            _current_organization_id.reset(self._token_id)
        if self._token_tenant is not None:
            _current_tenant.reset(self._token_tenant)

    async def __aenter__(self):
        return self.__enter__()

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return self.__exit__(exc_type, exc_val, exc_tb)


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Resolve public-portal tenants. Protected API scope is set by authenticated
    user dependencies after membership and tenant-selection checks.
    """

    # Paths that don't require tenant resolution
    EXEMPT_PATHS = [
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/onboarding",
        "/api/v1/platform",  # Platform owner endpoints
        "/api/v1/provisioning",  # Provisioning endpoints (router setup)
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
    ]

    # Portal paths that require subdomain/domain resolution
    PORTAL_PATHS = [
        "/api/v1/portal/hotspot",
        "/api/v1/portal/pppoe",
    ]

    def __init__(self, app, db_session_factory=None):
        super().__init__(app)
        self.db_session_factory = db_session_factory

    async def dispatch(self, request: Request, call_next) -> Response:
        """Process the request and resolve tenant."""
        tenant_context_token = _current_tenant.set(None)
        organization_context_token = _current_organization_id.set(None)
        try:
            organization_id = (
                None
                if request.method == "OPTIONS"
                else await self._resolve_tenant(request)
            )
            if organization_id:
                tenant = await self._load_tenant(organization_id)
                if not tenant:
                    return JSONResponse(
                        status_code=404,
                        content={"detail": "Organization not found"}
                    )
                set_current_tenant(tenant)

            response = await call_next(request)
            return response
        finally:
            _current_tenant.reset(tenant_context_token)
            _current_organization_id.reset(organization_context_token)

    async def _resolve_tenant(self, request: Request) -> Optional[int]:
        """
        Resolve the tenant from the request.

        Public portal routes may resolve their tenant from the route slug or
        configured portal domain. Protected API tenant scope is set later by
        the authenticated-user dependency, which validates membership.

        Returns:
            Organization ID if found, None otherwise
        """
        if any(request.url.path.startswith(path) for path in self.EXEMPT_PATHS):
            return None

        if not any(request.url.path.startswith(path) for path in self.PORTAL_PATHS):
            return None

        portal_prefix = next(
            path for path in self.PORTAL_PATHS
            if request.url.path.startswith(path)
        )
        route_slug = request.url.path[len(portal_prefix):].strip("/").split("/", 1)[0]
        if route_slug:
            organization_id = await self._lookup_by_slug(route_slug)
            if organization_id:
                return organization_id

        slug_param = request.query_params.get("org_slug")
        if slug_param:
            organization_id = await self._lookup_by_slug(slug_param)
            if organization_id:
                return organization_id

        organization_id = await self._resolve_from_subdomain(request)
        if organization_id:
            return organization_id

        organization_id = await self._resolve_from_custom_domain(request)
        if organization_id:
            return organization_id

        return None

    async def _resolve_from_subdomain(self, request: Request) -> Optional[int]:
        """
        Resolve organization from subdomain.

        Expected format: org-slug.ispbilling.com
        """
        from app.core.config import settings

        host = request.headers.get("Host", "")
        base_domain = getattr(settings, "portal_base_domain", "ispbilling.com")

        if not host or base_domain not in host:
            return None

        # Extract subdomain
        subdomain = host.replace(f".{base_domain}", "").split(":")[0]

        if not subdomain or subdomain in ["www", "api", "app"]:
            return None

        # Look up organization by slug
        return await self._lookup_by_slug(subdomain)

    async def _resolve_from_custom_domain(self, request: Request) -> Optional[int]:
        """
        Resolve organization from custom domain.

        Looks up portal_domain in organizations table.
        """
        host = request.headers.get("Host", "").split(":")[0]
        if not host:
            return None

        return await self._lookup_by_domain(host)

    async def _lookup_by_slug(self, slug: str) -> Optional[int]:
        """Look up organization ID by slug."""
        if not self.db_session_factory:
            return None

        try:
            from sqlalchemy import select
            from app.models.organization import Organization

            async with self.db_session_factory() as session:
                result = await session.execute(
                    select(Organization.id).where(Organization.slug == slug)
                )
                return result.scalar_one_or_none()
        except Exception:
            return None

    async def _lookup_by_domain(self, domain: str) -> Optional[int]:
        """Look up organization ID by custom domain."""
        if not self.db_session_factory:
            return None

        try:
            from sqlalchemy import select
            from app.models.organization import Organization

            async with self.db_session_factory() as session:
                result = await session.execute(
                    select(Organization.id).where(Organization.portal_domain == domain)
                )
                return result.scalar_one_or_none()
        except Exception:
            return None

    async def _load_tenant(self, organization_id: int) -> Optional["Organization"]:
        """Load full organization object."""
        if not self.db_session_factory:
            return None

        try:
            from sqlalchemy import select
            from app.models.organization import Organization, OrganizationStatus

            async with self.db_session_factory() as session:
                result = await session.execute(
                    select(Organization).where(
                        Organization.id == organization_id,
                        Organization.status.in_([
                            OrganizationStatus.ACTIVE,
                            OrganizationStatus.TRIAL
                        ])
                    )
                )
                return result.scalar_one_or_none()
        except Exception:
            return None
