import psycopg2
from fastapi import APIRouter, HTTPException
from psycopg2.extras import RealDictCursor

from app.database import get_connection
from app.schemas import ErrorResponse, UserRegisterRequest, UserRegisterResponse
from app.services.email_service import send_welcome_email

router = APIRouter(prefix="/api", tags=["users"])


@router.post(
    "/register",
    response_model=UserRegisterResponse,
    responses={400: {"model": ErrorResponse}},
)
def register_user(payload: UserRegisterRequest):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "INSERT INTO users (name, email) VALUES (%s, %s) "
            "RETURNING id, name, email, created_at",
            (payload.name, payload.email),
        )
        row = cur.fetchone()
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="This email is already registered.")
    finally:
        cur.close()
        conn.close()

    email_sent = send_welcome_email(row["name"], row["email"])

    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "created_at": row["created_at"],
        "email_sent": email_sent,
    }