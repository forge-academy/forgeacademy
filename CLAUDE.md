# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ForgeAcademy is a marketing site + enrollment funnel for a tech training academy (Nigeria-based, prices in Naira). It has two independent halves that talk only over HTTP:

- **`public/`** — a static, framework-free frontend (plain HTML/CSS/vanilla JS). No build step, no bundler, no npm dependencies despite the Next.js-flavored `.gitignore`.
- **`backend/`** — a FastAPI service that persists registrations/enrollments to Neon Postgres and sends transactional email via Resend.

## Running things

### Frontend
Serve `public/` with any static server. The repo is set up for the VS Code **Live Server** extension (`.vscode/settings.json` pins port 5501). `public/index.html` is the landing page; `public/src/pages/register.html` is the multi-step enrollment flow; `public/src/pages/admin.html` is the admin dashboard (admin-key login gate → enrollments table with a Confirm button per pending row).

- Asset paths are **relative**, and `register.html` lives one directory deeper (`src/pages/`), so its links use `../css/…` / `../js/pages/…`. Keep that in mind when moving files.
- `index.html` loads only `src/js/main.js`; `register.html` loads only `src/js/pages/register.js`.

### Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in DATABASE_URL and RESEND_API_KEY
python -m uvicorn app.main:app --reload
```
Runs on `http://localhost:8000`. Interactive API docs at `/docs`. Tables are auto-created on startup by `init_db()` (`app/database.py`) — there is no migration tool.

Env (`app/config.py`, documented in `backend/.env.example`): `DATABASE_URL` (required, app refuses to start without it), `RESEND_API_KEY`, `FROM_EMAIL` (default `onboarding@resend.dev`), `ADMIN_KEY` (guards `GET /api/enrollments` + the verify endpoint), `ACADEMY_NOTIFICATION_EMAIL` (recipient of the new-enrollment heads-up), `WHATSAPP_LINK_{UIUX,DATA,SWE}` + `PAID_STUDENTS_WHATSAPP_LINK` fallback (confirmation-email group link, chosen by `programme_key` via `WHATSAPP_LINKS_BY_PROGRAMME` in `config.py`). Every optional var no-ops cleanly when unset.

There is **no test suite** and no linter configured for either half.

## Architecture

### Backend request flow
`app/main.py` wires up CORS + two routers. Each router owns raw SQL against a psycopg2 connection — **no ORM**. `get_connection()` opens a fresh connection per request; every handler is responsible for `commit`/`rollback` and closing its cursor/connection in a `finally`.

- **`routers/users.py`** — `POST /api/register` (name + email). Duplicate email → `UniqueViolation` caught → HTTP 400. Sends a welcome email but returns 200 regardless of email success; `email_sent` in the response reflects it.
- **`routers/enrollments.py`** — the paid funnel. `require_admin(x_admin_key)` is the shared gate (header must equal `ADMIN_KEY`; the older `verify` handler still inlines the same check).
  - `POST /api/enrollments` — public. Records a pending enrollment with the programme, expected amount, referral code/discount, and a user-supplied bank **transfer reference**. Status starts `pending_verification`. Fires the "received" email to the student **and** the `send_academy_notification_email` heads-up to `ACADEMY_NOTIFICATION_EMAIL`.
  - `GET /api/enrollments` — admin-only. All rows, newest first (`EnrollmentAdminItem` schema). Feeds the admin dashboard.
  - `PATCH /api/enrollments/{id}/verify` — admin-only. The manual step: admin eyeballs their bank account, then calls this to flip status to `paid` and send the "confirmed" email. **Not called by the public site** (the admin dashboard calls it).
- **`services/email_service.py`** — thin Resend REST wrapper. Every function no-ops (returns `False`, prints) when `RESEND_API_KEY` is unset, and swallows `RequestException` — email is always best-effort and never blocks the DB write. The confirmation email appends the WhatsApp group link for the enrollment's `programme_key` (fallback `PAID_STUDENTS_WHATSAPP_LINK`); `send_enrollment_verified_email` takes `programme_key` for this, and the `verify` query's `RETURNING` was extended to supply it. **Don't touch the user-facing `send_welcome_email` / `send_enrollment_*` copy without a reason.**
- **`schemas.py`** — Pydantic request/response models; `EmailStr` needs `pydantic[email]` (already in requirements).

Payment is **manual bank-transfer reconciliation** by design. A Monnify webhook integration is noted as the intended next step but is not built.

### Frontend
`main.js` — landing-page widgets, each an `init*()` called on `DOMContentLoaded` (FAQ accordion, testimonial carousel with hardcoded data, hero typing effect, SVG process line that measures real DOM positions, mobile nav). Respects `prefers-reduced-motion`.

`js/pages/register.js` — one IIFE holding a 4-step wizard in a single `state` object. Steps are `.reg-card[data-step]` elements toggled via `hidden`. Programme catalog (key, label, price) lives in `data-*` attributes on `.programme-option` elements in the HTML, not in JS. `VALID_REFERRAL_CODES` (code → discount fraction) is hardcoded at the top of the file. Only the final step calls the API: `POST {API_BASE}/api/enrollments`.

`js/pages/admin.js` — one IIFE. Login gate stores `ADMIN_KEY` in `sessionStorage` (`fga_admin_key`) and sends it as the `X-Admin-Key` header on every call. "Sign in" is validated by attempting `GET /api/enrollments`. Renders the table client-side (all cell values run through `escapeHtml`); the Confirm button `PATCH`es the existing verify endpoint and patches the row in place. Styling: `css/admin.css` (loads after `base.css` for tokens and `components.css` for `.btn`).

- `API_BASE`: `register.js` hardcodes `https://forgeacademy.onrender.com`. `admin.js` uses `http://localhost:8000` on localhost, the onrender URL otherwise.
- **CORS** (`app/main.py`): explicit allowlist — prod origin `https://forgeacademy.name.ng` plus `localhost:5501` / `127.0.0.1:5501` for Live Server. Add any new frontend origin there.

### CSS
Stylesheets under `public/src/css/`, loaded per page in order: `base` (tokens/reset) → `layout` → `components` → page sheet (`register` / `admin`; `admin.html` skips `layout`). BEM-ish class names. CSS custom properties (`--color-orange-600`, etc.) are the styling contract shared with JS (e.g. register.js sets `borderColor` to a token on validation errors).

## Conventions

- `api-contracts/README.md` is an empty placeholder; the real, maintained API contract is **`backend/README.md`** — update it when you change request/response shapes.
- Branch + PR per change (`feat-*` branches merged into `main` via PR); `main` is the deploy branch.
- Comments in this codebase carry real intent/history — read the `TODO`/inline notes before changing CORS, email behavior, or the verify flow.
