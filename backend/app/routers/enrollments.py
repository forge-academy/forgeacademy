from typing import List

from fastapi import APIRouter, BackgroundTasks, HTTPException, Header
from psycopg2.extras import RealDictCursor

from app.database import get_connection
from app.schemas import EnrollmentAdminItem, EnrollmentCreateRequest, EnrollmentResponse
from app.config import ADMIN_KEY
from app.services.email_service import (
    send_academy_notification_email,
    send_enrollment_received_email,
    send_enrollment_verified_email,
)

router = APIRouter(prefix="/api", tags=["enrollments"])


def require_admin(x_admin_key: str) -> None:
    """Same gate the verify endpoint uses — the X-Admin-Key header must match ADMIN_KEY."""
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Not authorized.")


@router.post("/enrollments", response_model=EnrollmentResponse)
def create_enrollment(payload: EnrollmentCreateRequest, background_tasks: BackgroundTasks):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            INSERT INTO enrollments
              (full_name, email, phone, programme_key, programme_label,
               amount_expected, referral_code, discount_pct, ambassador_code, transfer_reference)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, full_name, email, programme_label, amount_expected, status, created_at
            """,
            (
                payload.full_name,
                payload.email,
                payload.phone,
                payload.programme_key,
                payload.programme_label,
                payload.amount_expected,
                payload.referral_code,
                payload.discount_pct,
                payload.ambassador_code,
                payload.transfer_reference,
            ),
        )
        row = cur.fetchone()
        conn.commit()
    finally:
        cur.close()
        conn.close()

    # Both emails go out after the response is returned, one after the other.
    # BackgroundTasks runs them sequentially, and _send_via_resend retries on
    # Resend's free-tier 429, so the academy heads-up isn't dropped just
    # because it followed the student email too closely.
    background_tasks.add_task(
        send_enrollment_received_email,
        row["full_name"], row["email"], row["programme_label"],
        row["amount_expected"], payload.transfer_reference,
    )
    background_tasks.add_task(
        send_academy_notification_email,
        row["full_name"], row["email"], row["programme_label"],
        row["amount_expected"], payload.transfer_reference,
    )

    return row


@router.get("/enrollments", response_model=List[EnrollmentAdminItem])
def list_enrollments(x_admin_key: str = Header(...)):
    """Admin dashboard feed — every enrollment, newest first. Admin-key gated,
    same as the verify endpoint. Not called by the public site."""
    require_admin(x_admin_key)

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT id, full_name, email, phone, programme_key, programme_label,
                   amount_expected, referral_code, discount_pct, ambassador_code, transfer_reference,
                   status, created_at, verified_at
            FROM enrollments
            ORDER BY created_at DESC
            """
        )
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    return rows


@router.patch("/enrollments/{enrollment_id}/verify", response_model=EnrollmentResponse)
def verify_enrollment(enrollment_id: int, x_admin_key: str = Header(...)):
    """You (the admin) call this once you've manually checked your bank
    account and seen the transfer land. Not called by the frontend."""
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Not authorized.")

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        UPDATE enrollments
        SET status = 'paid', verified_at = now()
        WHERE id = %s
        RETURNING id, full_name, email, programme_key, programme_label, amount_expected, status, created_at
        """,
        (enrollment_id,),
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    send_enrollment_verified_email(
        row["full_name"], row["email"], row["programme_label"], row["programme_key"]
    )

    return row