# Codevertex ISP Billing System - Backend

An evolving, development-stage ISP operations backend built with FastAPI. It
contains tenant-scoped billing and network-management APIs, but is not
production-ready; external integrations and several operator workflows still
require configuration, testing, or implementation.

## Features

### Core Features
- **RBAC System**: Role- and permission-based access controls with platform and tenant roles
- **User Management**: Complete user lifecycle management with multi-role authentication
- **MikroTik Integration**: Router inventory, provisioning, and agent code are present; real router operations require a separately authorized lab and are not verified by local API tests.
- **Automated Provisioning**: 3-step wizard (bootstrap one-liner → device scan → script-based service setup) with live WebSocket log streaming. See the [MikroTik Provisioning Guide](./docs/MIKROTIK_PROVISIONING_GUIDE.md).
- **Billing APIs**: Invoice, payment-history, and subscription APIs exist; settlement and activation must be validated against the configured central treasury service.
- **Centralized integrations**: Payment and notification delivery depend on treasury and notifications services; this checkout does not contain standalone local M-PESA/Paystack or SMS provider modules.
- **Router/usage status**: Analytics and reporting APIs are available; their output depends on real tenant data and authorization.
- **Background Tasks**: Celery-based task queue for billing, notifications, and maintenance

## Tech Stack

- **Framework**: FastAPI 0.104+
- **Database**: PostgreSQL 15+
- **Cache/Queue**: Redis 7+
- **Background Jobs**: Celery 5+
- **ORM**: SQLAlchemy 2.0+
- **Authentication**: JWT with refresh tokens
- **Validation**: Pydantic V2
- **Testing**: Pytest with async support
- **Documentation**: OpenAPI/Swagger with ReDoc

## Project Structure (legacy reference)

The tree below is an older scaffold, not a precise inventory of this checkout.
For the verified local workspace layout and commands, use
[docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md).

```
isp-billing-backend-master/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── core/                   # Core configuration and utilities
│   │   ├── __init__.py
│   │   ├── config.py          # Settings and configuration
│   │   ├── security.py        # JWT and password utilities
│   │   ├── database.py        # Database connection and session
│   │   └── logging.py         # Logging configuration
│   ├── models/                 # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── base.py            # Base model class
│   │   ├── user.py            # User and role models
│   │   ├── router.py          # Router and device models
│   │   ├── plan.py            # Service plans and packages
│   │   ├── subscription.py    # User subscriptions
│   │   ├── billing.py         # Invoices and payments
│   │   └── notification.py    # Notifications and tickets
│   ├── schemas/                # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── router.py
│   │   ├── plan.py
│   │   ├── subscription.py
│   │   ├── billing.py
│   │   └── notification.py
│   ├── api/                    # API routes
│   │   ├── __init__.py
│   │   ├── deps.py            # Dependencies and middleware
│   │   └── v1/                # API version 1
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── users.py
│   │       ├── routers.py
│   │       ├── plans.py
│   │       ├── subscriptions.py
│   │       ├── billing.py
│   │       └── notifications.py
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── user_service.py
│   │   ├── router_service.py
│   │   ├── billing_service.py
│   │   ├── mpesa_service.py
│   │   └── notification_service.py
│   ├── integrations/           # External service integrations
│   │   ├── __init__.py
│   │   ├── mikrotik.py        # MikroTik RouterOS API
│   │   ├── mpesa.py           # MPESA Daraja API
│   │   └── sms_email.py       # SMS and email services
│   ├── tasks/                  # Celery background tasks
│   │   ├── __init__.py
│   │   ├── billing_tasks.py
│   │   ├── notification_tasks.py
│   │   └── router_tasks.py
│   └── utils/                  # Utility functions
│       ├── __init__.py
│       ├── validators.py
│       ├── formatters.py
│       └── helpers.py
├── alembic/                    # Database migrations
│   ├── versions/
│   ├── env.py
│   └── script.py.mako
├── tests/                      # Test suite
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_routers.py
│   └── test_billing.py
├── scripts/                    # Utility scripts
│   ├── create_admin.py
│   └── migrate_data.py
├── docker/                     # Docker configurations
│   ├── Dockerfile
│   └── entrypoint.sh
├── env.example                # Environment variables template
├── .gitignore
├── pyproject.toml             # Project dependencies and configuration
├── requirements.txt           # Production dependencies
├── requirements-dev.txt       # Development dependencies
└── README.md
```

## Quick Start

### Development Setup

1. **Clone and setup environment:**
   ```bash
   cd isp-billing-backend-master
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements-dev.txt
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Replace every placeholder; keep real credentials in the ignored .env only.
   ```

3. **Setup database:**
   ```bash
   # Review migrations and back up data before applying; historical revisions include irreversible drops.
   alembic upgrade head
   ```

4. **Run development server:**
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
   ```

5. **Run Celery worker:**
   ```bash
   celery -A app.tasks worker --loglevel=info
   ```

### Docker and deployment status

The checkout contains a backend Dockerfile but no Docker Compose deployment
files. Its entrypoint starts the application without running migrations.
Review migrations, back up the target database, and apply the approved
`alembic upgrade head` as a separate release operation.

The previous GitOps workflow has been removed because pushes triggered
Kubernetes production deployments, cross-repository secret synchronization,
and container-start migrations. Those operations do not target the requested
VPS1Euro server and did not require a protected production approval. The
replacement `.github/workflows/ci.yml` runs backend checks only; VPS deployment
is not configured or enabled. This checkout is not connected to a Git
repository, so GitHub Actions cannot run until a repository is restored and
reviewed.

## API Documentation

- **Swagger UI**: http://127.0.0.1:8001/docs
- **ReDoc**: http://127.0.0.1:8001/redoc
- **OpenAPI JSON**: http://127.0.0.1:8001/openapi.json

## Environment Variables

See `env.example` for configuration names and placeholder values. Replace all
placeholders locally; never use example credentials for a deployed service.

## Testing

```bash
# Database-backed tests require TEST_DATABASE_URL pointing to a disposable
# local database named ispbilling_test*; local port 5432 is blocked.
pytest tests/ -v

# Run specific test file
pytest tests/test_auth.py -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

## 📚 Documentation

### Core Documentation
- **[Complete Setup Guide](./docs/SETUP_GUIDE.md)** - Detailed installation and configuration instructions
- **[API Documentation](./docs/API_DOCUMENTATION.md)** - Complete API reference and examples
- **[Implementation Guide](./docs/IMPLEMENTATION_GUIDE.md)** - Technical implementation details
- **[Project Summary](./docs/PROJECT_SUMMARY.md)** - High-level overview and architecture

### Feature-Specific Guides
- **[MikroTik Provisioning Guide](./docs/MIKROTIK_PROVISIONING_GUIDE.md)** - Canonical, current provisioning reference (NAT polling-agent + external captive portal)
- **[Provisioning Overview](./docs/PROVISIONING_GUIDE.md)** - Conceptual overview of the hotspot/captive-portal flow
- **[Connectivity & Billing Audit (2026-06)](./docs/AUDIT-AND-REMEDIATION-2026-06.md)** - Authoritative "how prod is wired" + shipped fixes
- **[RouterOS v6 vs v7 Comparison](./docs/mikrotikv6-v7-comparison.md)** - Command-syntax reference for provisioning scripts
- **[Reset / Cleanup Script](./docs/reset-router-provision.md)** - Manual wipe of codevertex config before reprovisioning
- **[Auth Mapping Guide](./docs/AUTH_MAPPING.md)** - Frontend to backend authentication mapping
- **[Swagger Authentication Guide](./docs/swagger_authentication_guide.md)** - API authentication setup

### Additional Resources
- **[OpenAPI Spec](./docs/openapi.json)** - OpenAPI 3.0 specification
- **[Platform vs Tenant Separation](./docs/PLATFORM-TENANT-SEPARATION.md)** - Platform-level vs tenant-level settings
- **[Backend Implementation Plan](./docs/plan.md)** - Feature/sprint status

## 🚀 Quick Links

- **Swagger UI**: http://127.0.0.1:8001/docs
- **ReDoc**: http://127.0.0.1:8001/redoc
- **Health Check**: http://127.0.0.1:8001/health

## 🔐 Default Credentials

After initial setup, use these credentials:

**Superuser Account** (Full system access):
- Username: `superuser`
- Password: `superuser123`

**Demo Admin Account** (ISP provider access):
- Username: `demo`
- Password: `demo123`

⚠️ **Important**: Change these passwords in production!

## 🛠️ Development Tools

- **Alembic**: Database migrations
- **Pytest**: Testing framework
- **Black**: Code formatting
- **Flake8**: Linting
- **MyPy**: Type checking
- **Pre-commit**: Git hooks

## 📊 Database Schema

The system uses PostgreSQL with the following main tables:
- `users` - User accounts and authentication
- `roles` & `permissions` - RBAC system
- `routers` - MikroTik devices
- `plans` - Service packages
- `subscriptions` - User subscriptions
- `invoices` & `payments` - Billing
- `licences` - Licence management
- `system_licences` - Trial licences

See [IMPLEMENTATION_GUIDE.md](./docs/IMPLEMENTATION_GUIDE.md) for complete schema documentation.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pytest tests/ -v`
5. Submit a pull request

## 📧 Support

For issues, questions, or contributions:
- **Email**: support@codevertexafrica.com
- **Documentation**: See `/docs` folder
- **GitHub Issues**: Create an issue in the repository

## 📝 License

MIT License - See LICENSE file for details

## 🏢 About Codevertex Africa Limited

Codevertex Africa Limited specializes in ISP management software, network automation, and billing systems.

---

**Version**: 1.0.0  
**Last Updated**: 2026-06  
**Status**: Production
