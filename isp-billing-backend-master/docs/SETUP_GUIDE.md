# ISPFlow Local Windows Setup

This guide documents the verified local development setup in this checkout. It is
not a production deployment guide.

Production deployment planning and read-only preflight gates are documented in
the workspace-level [VPS1Euro deployment readiness guide](../../docs/DEPLOYMENT_VPS1EURO.md).

## Project layout

- Backend: `C:\Users\brayo\Desktop\MAPITOPROJECT\isp-billing-backend-master`
- Frontend: `C:\Users\brayo\Desktop\MAPITOPROJECT\isp-billing-frontend`
- Python environment: `C:\Users\brayo\Desktop\MAPITOPROJECT\.venv`
- Local backend: `http://127.0.0.1:8001`
- Local frontend: `http://127.0.0.1:3000`
- API documentation: `http://127.0.0.1:8001/docs`
- Health endpoint: `http://127.0.0.1:8001/health`

Port `8000` was already occupied by a pre-existing local backend process whose
project directory could not be confirmed. It has been left untouched. The
updated checkout runs on loopback port `8001`.

The development PostgreSQL cluster is isolated on `127.0.0.1:55432`. Do not
change, reset, or run migrations against the unrelated PostgreSQL service on
port `5432`.

## Start the isolated database

If the local development cluster is stopped, start that cluster only:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' `
  -D 'C:\Users\brayo\AppData\Local\IspBillingLocalTest\postgres-data' `
  -l 'C:\Users\brayo\AppData\Local\IspBillingLocalTest\postgres.log' start
```

The backend's ignored `.env` must contain a `DATABASE_URL` using the installed
async PostgreSQL driver and the loopback development port:

```text
postgresql+asyncpg://<local-user>:<local-password>@127.0.0.1:55432/ispbilling_local
```

Keep database credentials, JWT keys, payment placeholders, and the local admin
password in that ignored `.env` only. Never copy them into documentation, source
files, frontend variables, terminal output, or commits. The local seed settings
are named `GLOBAL_ADMIN_EMAIL` and `GLOBAL_ADMIN_PASSWORD`.

The last verified application-database revision is `c1d2e3f4a5b6`. The
per-organization tax-rate and router-password encryption migrations were
applied only to the isolated database on port `55432`. This checkout adds
`d2e3f4a5b6c7` to encrypt existing router-agent tokens; it has not been applied
to the application database as part of this readiness work.

Keep the configured encryption key stable: changing it prevents decryption of
stored router credentials. The development fallback is derived from
`SECRET_KEY` and emits a warning; configure a dedicated strong
`ENCRYPTION_KEY` in the ignored backend `.env` for deployments. Do not expose
or rotate encryption keys without first following a credential re-encryption
procedure.

## Apply migrations safely

Run these commands from the backend directory, after confirming that `.env`
points to the isolated `127.0.0.1:55432` database:

```powershell
Set-Location 'C:\Users\brayo\Desktop\MAPITOPROJECT\isp-billing-backend-master'
& 'C:\Users\brayo\Desktop\MAPITOPROJECT\.venv\Scripts\python.exe' -m alembic current
& 'C:\Users\brayo\Desktop\MAPITOPROJECT\.venv\Scripts\python.exe' -m alembic upgrade head
```

Do not use `--fresh-install`, database reset scripts, or setup commands that
delete data. Review each migration before applying it: historical revisions
include irreversible table/column drops. The Docker entrypoint does not run
migrations automatically; apply them as a separately reviewed release step
after taking and verifying a backup.

## Migration and backup readiness

The current Alembic graph has one head, `d2e3f4a5b6c7`. Do not treat the
history as uniformly additive:

- `b8c9d0e1f2a3` drops deprecated payment-gateway, licensing, and
  platform-billing tables plus `organizations.subscription_tier_id`. Its
  downgrade is intentionally empty.
- `e1f2a3b4c5d6` drops SMS-credit and WhatsApp tables plus
  `organizations.sms_sender_id`. Its downgrade is intentionally empty.
- `c1d2e3f4a5b6` converts stored router passwords to encrypted values. It needs
  the same stable `ENCRYPTION_KEY` or `MASTER_PASSWORD` for migration,
  application use, and any downgrade/decryption.
- `d2e3f4a5b6c7` encrypts reusable router-agent tokens already stored in
  `routers.agent_token_plain`. It requires the same stable encryption key for
  migration and runtime; downgrade is intentionally refused to avoid restoring
  reusable tokens as plaintext. Use a compatible application rollback or a
  separately reviewed recovery plan instead.
- The other revisions add schema objects or columns. Their downgrade functions
  can still drop data added to those objects after migration. The initial
  revision creates the base schema and is for a new database, not a substitute
  for reconciling an existing schema.

Before any production migration, obtain approval, freeze writes for the change
window, preserve a verified backup, confirm the schema revision and application
compatibility, and separately archive any deprecated data that must be retained.
No production database has been migrated as part of this local readiness work.
Do not use `alembic downgrade` as an automatic rollback for the two irreversible
cleanup revisions or the router-agent token encryption revision.

In production, prefer a stable Fernet `ENCRYPTION_KEY`. If using
`MASTER_PASSWORD`, provide a stable base64-encoded `ENCRYPTION_SALT` as well;
production configuration now rejects a master password without its salt.

### PostgreSQL backup and isolated restore verification

On the database host, provision a private `PGPASSFILE` through the approved
secret-management process (owner-readable only; mode `0600`). Do not put a
database password in shell arguments, shell history, CI logs, or this guide.
Set `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, and `PGPASSFILE` in the
protected maintenance environment, then create and inspect a custom-format
backup:

```sh
umask 077
BACKUP_FILE="/var/backups/ispflow/ispflow-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-acl --file="$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE" >/dev/null
```

Verify the backup by restoring it into a **new, uniquely named empty database**,
never over the application database:

```sh
RESTORE_DB="ispflow_restore_verify_$(date -u +%Y%m%d%H%M%S)"
createdb --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" "$RESTORE_DB"
pg_restore --no-owner --no-acl --dbname="$RESTORE_DB" "$BACKUP_FILE"
psql --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
  --dbname="$RESTORE_DB" --command='SELECT current_database();'
```

Run application/schema checks against that restored database and record the
result before any maintenance. This procedure intentionally omits `--clean`,
`--if-exists`, and database deletion. For rollback, restore the verified backup
to another new database, validate it, and only then follow an approved
application connection-switch procedure; retain the original database and
backup until the recovery decision is complete.

The encryption migration has not been run with a production key. Production
key continuity cannot be proven from this workspace: the production key must
be provisioned securely, remain stable across releases, and be verified by
authorized operators without printing it.

## Start the backend

From the backend directory:

```powershell
Set-Location 'C:\Users\brayo\Desktop\MAPITOPROJECT\isp-billing-backend-master'
& 'C:\Users\brayo\Desktop\MAPITOPROJECT\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Keep the host bound to `127.0.0.1`; do not expose this development service on a
public or LAN interface.

## Start the frontend

In a second PowerShell window:

```powershell
Set-Location 'C:\Users\brayo\Desktop\MAPITOPROJECT\isp-billing-frontend'
npm run dev -- --host 127.0.0.1 --port 3000
```

The ignored frontend `.env.local` sets `VITE_API_BASE_URL=http://127.0.0.1:8001`
so the running frontend uses the updated backend without changing the service
on port `8000`. If the backend port changes, update this local override to the
API origin.

## Sign in and verify

- Open the public site at `http://127.0.0.1:3000`.
- Use **Sign in** to open `/login`; the verified local platform account's
  identifier is `superuser`. Read its local password from the ignored backend
  `.env` when needed; it is intentionally not repeated here.
- Open `http://127.0.0.1:8001/docs` to inspect the API schema.
- Open `http://127.0.0.1:8001/health` to check backend health.

Registration verification codes may be exposed by the development-only
`ONBOARDING_EXPOSE_DEV_CODES` setting. Keep this API loopback-only and disable
that setting outside local development. Local payment configuration is
placeholder-only; this setup does not send real payments or modify routers.

The public homepage and catalogue routes are available without authentication.
The homepage dashboard illustration is explicitly labelled as illustrative; it
is not sourced from tenant or customer data. Integration status on the public
pages reflects this checkout and does not assert a live provider connection.

## Operator workspace status

After sign-in, `/app` provides a responsive operator workspace. The UI uses
tenant-scoped APIs and displays request errors rather than presenting failed
requests as successful. Current workflows are:

- Overview, CRM lead listing, usage aggregates, dashboard analytics, reports,
  and authenticated CSV exports.
- Subscriber search/pagination plus administrator create, edit, and deactivate
  actions. Newly created customers remain pending verification; this form does
  not send credentials or contact messages.
- Package search/pagination and administrator create, edit, enable/disable
  actions, including access type, speeds, duration, data caps, and fair-use
  fields.
- Invoice creation and paginated invoice/payment-history views. The UI does not
  create payment records, call payment providers, or mark invoices as paid.
- Support ticket search/filter/pagination; administrator create, priority,
  assignment/unassignment, resolve, and close actions. Backend authorization
  restricts customer ticket access to their own cases and hides internal notes.
- Staff listing, administrator role/status actions, and read-only organization
  details.
- Pending subscription assignment to an existing customer, package, and router.
  Creating an assignment does not activate service or issue a router command.
- Router inventory create/edit operations save metadata only. Connection status
  uses stored router/agent evidence; credentials are neither sent by the
  browser nor returned in router responses. No router command is issued.
- Captive portal settings persist through the tenant hotspot/business settings
  APIs. The sandboxed sample preview is not a deployed portal. Branding is
  read-only because its source of truth is the identity service.
- Voucher inventory remains read-only and voucher codes are masked. Usage
  charts are aggregates rather than a live session list.

These workflows do not amount to complete ISPFlow feature parity. There is no
safe local simulated-payment workflow, voucher create/redeem UI, router
provisioning-script preview/deployment UI, full identity-provider owner invite
flow, or customer self-service portal. Platform owners can manage persistent
organization records, but creating an organization does not create an
identity-provider owner. The tax-rate schema addition is the only migration in
this change; it preserves existing rows with a zero default.

Platform owners must explicitly choose an organization before tenant data is
requested. A separate local test ISP was registered through the development
onboarding flow in the isolated `127.0.0.1:55432` database. Its operator login
identifier is stored in the ignored `.env` as `LOCAL_TEST_ADMIN_EMAIL`; its
random password is stored as `LOCAL_TEST_ADMIN_PASSWORD`. Do not copy either
value into source control. The platform-owner organization list includes
SSO-linked tenants and locally created/onboarded organizations, excluding only
the unlinked platform bootstrap organization.

The customer self-service UI is not implemented; customers must not use the
operator workspace. The payment API's administrator manual-record path means
funds were already received out-of-band and may mark an invoice/subscription
paid/active. Do not use that endpoint as a local test-payment substitute.

## Security and feature status

Authenticated tenant access is derived from the user's authorized organization;
caller-supplied tenant selectors are not authorization. Platform owners must
select an existing tenant for tenant-scoped work. Router inventory list/create/
edit/delete operations use the selected tenant as the database scope. Router
action capabilities are short-lived and scoped; do not publish router
credentials or tokens.

Router changes, payment collection, and other external operations must remain
disabled unless a separately authorized lab environment and provider setup are
available. Optional RADIUS, PayHero, SMS, email, and router features require
their respective external services and are not verified by a successful local
login.

The following focused tests use fakes and do not need a database. Database-backed
tests require an explicit `TEST_DATABASE_URL` targeting a disposable local
database whose name begins with `ispbilling_test`; the fixture creates and drops
tables in that database. Local test runs are blocked from PostgreSQL port `5432`.
CI uses a disposable PostgreSQL service container.

```powershell
Set-Location 'C:\Users\brayo\Desktop\MAPITOPROJECT\isp-billing-backend-master'
& 'C:\Users\brayo\Desktop\MAPITOPROJECT\.venv\Scripts\python.exe' -m pytest --noconftest `
  tests\test_ticket_tenant_authorization.py `
  tests\test_customer_creation_tenant_scope.py `
  tests\test_tenant_business_settings_persistence.py `
  tests\test_confirmed_tenant_idor_regressions_20261024.py `
  tests\test_plan_subscription_tenant_boundaries_regression.py `
  tests\test_users_api_tenant_scope_regression.py -q
```
