# ForgeAcademy Backend

FastAPI service for ForgeAcademy: newsletter-style user registration plus the
paid-enrollment funnel. Stores data in Neon Postgres and sends transactional
email via Resend. Payment is reconciled manually by an admin through the admin
dashboard (`public/src/pages/admin.html`).

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then fill in real DATABASE_URL and RESEND_API_KEY
python -m uvicorn app.main:app --reload
```

Runs at `http://localhost:8000` by default.

### Environment variables

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string. App refuses to start without it. |
| `RESEND_API_KEY` | no | Resend API key. Unset → all emails are skipped (logged, not raised). |
| `FROM_EMAIL` | no | Sender address. Default `onboarding@resend.dev`. |
| `ADMIN_KEY` | no | Shared secret for the admin endpoints (`GET /api/enrollments`, `PATCH .../verify`), sent as the `X-Admin-Key` header. Default `""`. |
| `ACADEMY_NOTIFICATION_EMAIL` | no | Recipient of the "new enrollment" heads-up email. Unset → that email is skipped. |
| `WHATSAPP_LINK_UIUX` / `WHATSAPP_LINK_DATA` / `WHATSAPP_LINK_SWE` | no | Per-programme paid-students WhatsApp group links. The confirmation email uses the one matching the enrollment's `programme_key`. |
| `PAID_STUDENTS_WHATSAPP_LINK` | no | Fallback group link used when the enrollment's programme has no link of its own. If neither applies, the link line is omitted. |

### Database schema

`init_db()` runs on startup and creates `users` and `enrollments` **only if they
don't already exist**. The one exception is `enrollments.ambassador_code`,
added via an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` that runs on
every startup — safe to re-run, and it backfills the column on a Neon database
that already had the table before ambassador codes existed. No manual
migration step is needed.

---

## API Documentation

Base URL (local dev): `http://localhost:8000`
Base URL (production): _TBD once deployed - will update here_

### `POST /api/register`

Registers a new user and sends a welcome email.

**Request body**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| name | string | yes | Any non-empty string |
| email | string | yes | Must be a valid email address |

**Success response - `200 OK`**

```json
{
  "id": 1,
  "name": "Jane Doe",
  "email": "jane@example.com",
  "created_at": "2026-09-03T09:52:00.123456",
  "email_sent": true
}
```

`email_sent` reflects whether the welcome email actually went out. It can be
`false` even on a successful registration, for example if Resend is
misconfigured. The user is still saved. The frontend should treat `200` as
"registration succeeded" regardless of this field, and can optionally show a
soft warning if `email_sent` is `false`.

**Error - `400 Bad Request`** (duplicate email)

```json
{
  "detail": "This email is already registered."
}
```

**Error - `422 Unprocessable Entity`** (validation failure, for example a
missing field or malformed email) - standard FastAPI validation error shape.

---

## Enrollments (paid funnel)

### `POST /api/enrollments`

Public. Records a pending enrollment together with the bank-transfer reference
the student supplies. Sends a "we've received it" email to the student
(best-effort, dispatched as a background task after the response).

This endpoint does **not** send the academy's new-enrollment heads-up — that's
a separate call, see `POST /api/enrollments/{id}/notify-academy` below. The two
used to be queued together as background tasks off this one request, but
weren't both reliably landing, so the frontend now triggers them as two
distinct request/response cycles: this one on submit, the other when the
student dismisses the post-registration success popup.

**Request body**

```json
{
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "08012345678",
  "programme_key": "swe",
  "programme_label": "Software Engineering",
  "amount_expected": 35000,
  "referral_code": "VICTORIA",
  "discount_pct": 0.067,
  "ambassador_code": null,
  "transfer_reference": "TRF-8842"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| full_name | string | yes | |
| email | string | yes | Valid email address |
| phone | string | no | |
| programme_key | string | yes | Machine key, e.g. `swe` |
| programme_label | string | yes | Display name, e.g. `Software Engineering` |
| amount_expected | number | yes | Naira, after any discount |
| referral_code | string | no | A discount code (see `VALID_REFERRAL_CODES` in `register.js`) — reduces `amount_expected` |
| discount_pct | number | no | Fraction (e.g. `0.067`), defaults to `0` |
| ambassador_code | string | no | An ambassador code (see `AMBASSADOR_CODES` in `register.js`) — **carries no discount**, recorded purely so admins can see who signed up through which ambassador. Mutually exclusive with `referral_code` in the current UI (one input field, one or the other applies). |
| transfer_reference | string | yes | The student's bank transfer reference/narration |

**Success response - `200 OK`**

```json
{
  "id": 10,
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "programme_label": "Software Engineering",
  "amount_expected": 35000.0,
  "status": "pending_verification",
  "created_at": "2026-09-10T09:52:00.123456"
}
```

New rows always start at `status: "pending_verification"`.

### `POST /api/enrollments/{id}/notify-academy`

Public. Sends the academy's new-enrollment heads-up (to
`ACADEMY_NOTIFICATION_EMAIL`) for the given enrollment — best-effort,
dispatched as a background task after the response, same as the student
email. The frontend calls this once, right after the student dismisses the
"submission successful" popup that follows `POST /api/enrollments`.

**Success response - `200 OK`**

```json
{ "notified": true }
```

**Error - `404 Not Found`** — no enrollment with that id.

### `GET /api/enrollments`

**Admin only.** Requires header `X-Admin-Key: <ADMIN_KEY>`. Returns every
enrollment, newest first. Used by the admin dashboard; not called by the public
site.

**Headers**

| Header | Required | Notes |
|---|---|---|
| X-Admin-Key | yes | Must equal the server's `ADMIN_KEY` |

**Success response - `200 OK`** — JSON array of:

```json
{
  "id": 10,
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "08012345678",
  "programme_key": "swe",
  "programme_label": "Software Engineering",
  "amount_expected": 35000.0,
  "referral_code": "VICTORIA",
  "discount_pct": 0.067,
  "ambassador_code": null,
  "transfer_reference": "TRF-8842",
  "status": "pending_verification",
  "created_at": "2026-09-10T09:52:00.123456",
  "verified_at": null
}
```

**Error - `403 Forbidden`** — key missing/wrong: `{"detail": "Not authorized."}`
(a missing `X-Admin-Key` header is `422` — standard FastAPI missing-header shape).

### `PATCH /api/enrollments/{id}/verify`

**Admin only.** Requires header `X-Admin-Key: <ADMIN_KEY>`. The admin calls this
after eyeballing the bank account and seeing the transfer land. Flips `status`
to `paid`, stamps `verified_at`, and sends the student the confirmation email
(which includes the WhatsApp group link for their `programme_key`, falling back
to `PAID_STUDENTS_WHATSAPP_LINK`).

**Success response - `200 OK`** — same shape as `POST /api/enrollments`, with
`status: "paid"`.

**Error - `403 Forbidden`** — key missing/wrong.
**Error - `404 Not Found`** — no enrollment with that id: `{"detail": "Enrollment not found."}`

### `DELETE /api/enrollments/{id}`

**Admin only.** Requires header `X-Admin-Key: <ADMIN_KEY>`. Permanently deletes
an enrollment whose payment never got confirmed (spam, no transfer landed,
wrong reference, etc.) and emails the student that they can re-apply.
**Irreversible — there's no undo.** Scoped to `status: "pending_verification"`
rows only: an already-`paid` enrollment can't be deleted this way, since the
"payment wasn't confirmed" decline email would be false for it.

**Success response - `200 OK`**

```json
{
  "id": 10,
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "deleted": true
}
```

**Error - `403 Forbidden`** — key missing/wrong.
**Error - `404 Not Found`** — no enrollment with that id.
**Error - `400 Bad Request`** — the enrollment exists but isn't
`pending_verification` (e.g. already `paid`): `{"detail": "Only a pending
(unconfirmed) enrollment can be deleted this way."}`

---

### `GET /health`

Health check. No auth, no params.

**Response - `200 OK`**

```json
{
  "status": "ok"
}
```

---

## Notes for frontend integration

- CORS `allow_origins` is an explicit allowlist in `app/main.py`:
  `https://forgeacademy.name.ng` (prod) plus `http://localhost:5501` /
  `http://127.0.0.1:5501` for the admin dashboard under VS Code Live Server.
  Add any other origin you serve the frontend from.
- The only auth is the `X-Admin-Key` shared secret on the two admin enrollment
  endpoints. `/api/register` and `POST /api/enrollments` are unauthenticated.
- Payment verification is **manual**: an admin confirms each transfer via the
  admin dashboard / `PATCH .../verify`. Automated confirmation (Monnify webhook)
  is still a future piece.
