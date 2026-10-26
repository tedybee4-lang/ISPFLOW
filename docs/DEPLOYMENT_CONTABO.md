# ISPFlow Contabo Deployment

## Server
- Host: `169.58.202.177`
- OS: Ubuntu 24.04.5 LTS
- Runtime: Python venv, PostgreSQL 16, Redis 7, Nginx, systemd

## Layout
- Source: `/opt/ispflow/src`
- Virtualenv: `/opt/ispflow/venv`
- Backend: `/opt/ispflow/src/isp-billing-backend-master`
- Frontend: `/var/www/ispflow`
- Secrets: `/opt/ispflow/secrets` (mode 700)
- Backups: `/opt/ispflow/backups`

## First-time setup
1. Install packages:
   `postgresql postgresql-contrib redis-server nginx python3-venv python3-dev build-essential libpq-dev curl git ufw unattended-upgrades certbot python3-certbot-nginx`
2. Create `ispflow` user and directories.
3. Create PostgreSQL database/user `ispbilling`/`ispflow`.
4. Clone repository to `/opt/ispflow/src`.
5. Create venv and install `isp-billing-backend-master/requirements.prod.txt`.
6. Create `.env` from `deploy/env/ispflow.env.example`; never commit it.
7. Run `alembic upgrade head`.
8. Install systemd units from `deploy/systemd`.
9. Configure Nginx from `deploy/nginx/ispflow.conf`.
10. Enable firewall: 22, 80, 443.

## Deployment
Run `scripts/deploy_contabo.sh` or the GitHub Actions production workflow.

## Backup and restore
- Backup: `scripts/backup_postgres.sh`
- Restore: `scripts/restore_postgres.sh <file>`

## DNS and HTTPS
Do not change DNS until the IP deployment is verified. Required records after approval:
- `ispflow.co.ke` A/AAAA -> `169.58.202.177`
- `api.ispflow.co.ke` A/AAAA -> `169.58.202.177`

Configure HTTPS with certbot after DNS points to this server.

## Rollback
Use `/tmp/ispflow-previous-commit` to reset the previous application commit, then restart services. Database downgrades are not automatic and require a reviewed restore procedure.
