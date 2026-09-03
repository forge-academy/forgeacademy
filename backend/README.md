# ForgeAcademy Backend

FastAPI service handling user registration: stores registered users in Neon
Postgres and sends a welcome email via Resend.

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

- CORS is currently open (`*`) for local development. This will be locked
  down to the production frontend origin before launch - flag if you need a
  specific dev origin whitelisted in the meantime.
- There is no authentication on `/api/register` yet. This is registration-only,
  not login. Auth is a separate, later piece.
- Payment confirmation and the paid-status flag on a user are not yet
  implemented in this service. That is the next piece being built (Monnify
  webhook integration), not part of this initial handoff.
