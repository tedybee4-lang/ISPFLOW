# ISPFlow VPS1Euro deployment readiness

This document and `.github/workflows/production-deployment.yml` prepare
read-only production preflight checks. They do **not** deploy the application,
change DNS, install server packages, or run database migrations. No workflow has
connected to the VPS as part of this preparation.

## Current repository evidence

- Repository branch: `main`.
- Frontend: Vite static build (`npm ci`, `npm run build`, output in `dist/`).
- Backend: FastAPI application (`app.main:app`) with Alembic and PostgreSQL.
- The backend Dockerfile is based on `python:3.11-slim`; its entrypoint only
  starts the supplied process and intentionally does not run migrations.
- There is no checked-in production Compose stack, systemd unit, reverse-proxy
  configuration, release manager, or rollback command. The deployment action
  therefore remains absent; a preflight success cannot make a release.
- Alembic history includes irreversible cleanup revisions
  `b8c9d0e1f2a3` and `e1f2a3b4c5d6`, which drop deprecated tables/columns.
  Revision `c1d2e3f4a5b6` encrypts existing router passwords, and
  `d2e3f4a5b6c7` encrypts reusable router-agent tokens. The latter is not safe
  to downgrade to plaintext.

## Manual workflow and safety gates

The production workflow is manual-only and targets the protected GitHub
Environment named `production`. Configure that environment with required
reviewers, a deployment branch rule restricted to `main`, and the variables and
secrets listed below. Its dispatch input defaults to false. When explicitly
enabled, it builds the frontend, compiles the backend, checks the Alembic graph,
tests the configured public endpoint by direct IP override (not DNS), and
connects by SSH only with strict host-key checking to invoke a root-managed,
read-only preflight helper.

The helper must be independently reviewed and installed at
`/usr/local/libexec/ispflow-readonly-preflight` before the SSH check can pass.
It must print **one JSON object only**, with no secrets, and must perform
read-only checks. Required fields:

```json
{
  "deploy_user_uid": 1001,
  "current_alembic_revision": "12-character-current-revision",
  "target_alembic_revision": "12-character-release-head",
  "pending_migrations": [],
  "candidate_schema_compatible": true,
  "migration_review_completed": true,
  "backup_verified": true,
  "backup_verified_at": "2026-10-25T00:00:00Z",
  "backup_restore_tested": true,
  "backup_restore_verified_at": "2026-10-25T00:00:00Z",
  "encryption_continuity_verified": true,
  "encrypted_router_credentials_verified": true,
  "encryption_key_id": "non-secret-operator-managed-key-version",
  "public_ipv6": "verified-public-ipv6-address"
}
```

The helper reports the current revision, release head, and pending revisions.
The preflight does not execute `alembic upgrade`, `downgrade`, or any database
mutation. A new or changed revision requires a separately reviewed migration
plan and a recent, independently restore-tested backup. Destructive cleanup
revisions must never be run automatically; if either destructive revision is
pending, preflight fails.

The key ID is a non-secret identifier, not a key or a derived value that could
reveal it. Keep the actual stable Fernet `ENCRYPTION_KEY` (or the stable
`MASTER_PASSWORD` plus `ENCRYPTION_SALT`) only in the server's approved secret
store. The helper must verify that the configured key can decrypt existing
encrypted router credentials and agent tokens without logging plaintext,
ciphertext, or the key. Do not authorize an encryption migration until that
continuity check, backup/restore check, and a reviewed migration procedure all
pass.

### Protected GitHub `production` environment configuration

**Secrets**

- `VPS_DEPLOY_SSH_PRIVATE_KEY` — dedicated key for the non-root deployment
  account only; do not reuse a personal or root key.
- `VPS_DEPLOY_KNOWN_HOSTS` — exact OpenSSH known-hosts entry, including
  `[host]:port`, obtained from and verified against trustworthy VPS1Euro
  information. Never populate this using an unverified `ssh-keyscan` result.

**Environment variables**

- `VPS_SSH_HOST` — `vps-356313.ssh.vps1euro.fr`.
- `VPS_SSH_PORT` — `9254`.
- `VPS_DEPLOY_USER` — dedicated, restricted, non-root user; provision and test
  the account through an explicitly approved server-maintenance phase.
- `VPS_PUBLIC_IPV6` — actual publicly reachable application IPv6, verified
  independently. The supplied address is a candidate, not verified reachability.
- `VPS_PUBLIC_IPV4` — optional; set only after confirming public IPv4 is
  assigned and reachable. Do not infer it from the SSH proxy.
- `VPS_HEALTHCHECK_URL` — HTTPS health endpoint on `ispflow.co.ke`.
- `PRODUCTION_ENCRYPTION_KEY_ID` — non-secret key version/identifier that the
  remote read-only helper reports. Never store the encryption key in GitHub
  Actions variables or logs.

GitHub environment protection (reviewers and branch restrictions) is a required
control, not an optional convenience. Do not use the previously shared PAT.
Use a dedicated GitHub credential flow only if a later approved task requires
it.

## Host identity, networking, and IPv6

The SSH proxy hostname/port is an SSH access endpoint, not proof of the web
server's public IPv4 or IPv6. Obtain the SSH host-key fingerprint from an
authenticated provider control panel or provider support, verify it out of
band, then pin its known-hosts line in the protected environment secret. Never
disable `StrictHostKeyChecking`.

Before preparing DNS, verify the actual public addresses from both the provider
and an independent external network. The workflow's health probe pins
`ispflow.co.ke` to the configured IP for HTTPS/TLS validation and does not
query or edit Truehost DNS records. IPv4 is optional; IPv6 must pass before an
AAAA record is considered.

## 1 vCPU / 1 GB RAM / 20 GB disk considerations

Do not assume that colocating PostgreSQL, Redis, the API, a worker, and a reverse
proxy is safe on this VPS. Prefer an externally managed database/cache on
private, access-controlled networking if available; otherwise measure memory,
disk, backup space, and workload under representative tests before choosing a
single-host layout. Build the static frontend in GitHub Actions rather than on
the VPS. Keep backend worker/process counts low and enforce memory limits only
after measuring actual service needs. The checked-in Dockerfile is not a
complete deployment architecture and has not been resource-tested on this
machine.

## Required deployment design before enabling changes

1. Verify provider ownership, host fingerprint, SSH route, public address
   reachability, and firewall policy. No connection was made during this task.
2. Through a separately approved server setup, create a dedicated non-root
   deployment account, restrict its SSH key and commands, and install/review the
   read-only preflight helper. Do not make root the CI deployment identity.
3. Choose and document the production runtime, reverse proxy/TLS termination,
   database/cache placement, resource limits, persistent data directories, and
   service health checks. No production runtime configuration is currently
   committed.
4. Define immutable release directories keyed by the commit SHA. Preserve the
   current release and data. Upload/build a candidate release to a new
   directory, verify its health before switching a `current` pointer, retain
   previous releases, and document an operator-approved rollback. Rollback
   changes application code only; never downgrade the database automatically.
5. Prepare an encrypted/permission-restricted PostgreSQL backup and restore it
   to a distinct verification database. Keep the application database and
   existing releases intact.
6. Review each migration from the actual current database revision. Require
   explicit approval for data changes. Do not automate the two irreversible
   cleanup revisions. For the encryption revisions, prove stable-key
   continuity and decryptability before migration; the token-encryption
   downgrade intentionally refuses plaintext restoration.
7. Only after these items, tests, and environment protection are verified,
   design a separate deployment job and require a deliberate production change
   approval. A passing preflight alone never deploys.

## Truehost DNS change plan (not applied)

1. Export and record current Truehost DNS records, TTLs, and the rollback values.
2. Independently verify the production HTTPS health check over the confirmed
   public IPv6 address. Add an AAAA record for the intended hostname only after
   the IPv6 service, firewall, reverse proxy, and certificate are verified.
3. Add an A record only if a public IPv4 address is independently confirmed;
   never use the SSH proxy address as the web A record.
4. Use a conservative TTL for a planned cutover, confirm certificate issuance,
   and check resolution and HTTPS from multiple external networks.
5. Roll back only by restoring the recorded prior DNS values if checks fail.

No DNS lookups intended to alter records, DNS updates, VPS connections, package
installations, migrations, deployments, router changes, or payment requests
were performed in this preparation.
