# ISPFlow web frontend

This repository contains a local-first public website and authentication shell for ISPFlow. It is a Vite single-page application; the backend remains in `../isp-billing-backend-master`.

## Run locally on Windows

From this directory:

```powershell
npm install
npm run dev -- --port 3000
```

Open <http://127.0.0.1:3000>. The frontend uses `http://127.0.0.1:8000` as its local API by default. To override it, copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL`.

The backend must be running and configured separately. Its local `.env` is ignored by Git. Keep generated database and administrator credentials there; never copy them into frontend settings or commit them.

## Routes

Public pages include `/`, `/features`, `/features/:feature`, `/integrations`, `/pricing`, `/about`, `/contact`, `/docs`, `/privacy`, `/terms` and `/status`. Authentication pages are `/login`, `/register` and `/forgot-password`. `/app` is a minimal authenticated identity check, not a complete operator dashboard.

Registration uses the backend's email verification, business details and account-creation endpoints. The local setup opts into a development-only verification code because outbound email is not configured. This flag must stay disabled outside local development. Production email delivery, password recovery, a contact endpoint, reviewed legal policies, pricing, and operator/customer workspaces are not included in this frontend.

## Integration status

The website labels capabilities based on repository evidence and avoids representing illustrative dashboard figures as live data. Payment, router, RADIUS and notification claims remain subject to provider/hardware configuration and end-to-end verification. No payment request or live router operation is triggered by the public pages.

Build the static frontend with:

```powershell
npm run build
```

Set the correct API origin and verified contact configuration in the deployment environment before hosting. Production hosting must provide SPA route fallback and HTTPS; this project does not configure DNS or deploy the site.
