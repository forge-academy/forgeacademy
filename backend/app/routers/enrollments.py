import threading
from typing import List

from fastapi import APIRouter, BackgroundTasks, HTTPException, Header
from psycopg2.extras import RealDictCursor

from app.database import get_connection
from app.schemas import (
    EnrollmentAdminItem,
    EnrollmentCreateRequest,
    EnrollmentDeleteResponse,
    EnrollmentResponse,
)
from app.config import ADMIN_KEY
from app.services.email_service import (
    send_academy_notification_email,
    send_enrollment_declined_email,
    send_enrollment_received_email,
    send_enrollment_verified_email,
)

router = APIRouter(prefix="/api", tags=["enrollments"])


def require_admin(x_admin_key: str) -> None:
    """Same gate the verify endpoint uses — the X-Admin-Key header must match ADMIN_KEY."""
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Not authorized.")


def _send_enrollment_emails(full_name, email, programme_label, amount_expected, transfer_reference):
    """Fires the student's "received" email and the academy heads-up at the
    same time, each on its own thread, instead of one after another. As two
    sequential BackgroundTasks they'd block in order — so a Resend 429 retry
    on the first (up to ~20s across 4 attempts) delayed the academy email
    behind it. Starting both immediately means the academy notification goes
    out right alongside the student confirmation, not after it."""
    t1 = threading.Thread(
        target=send_enrollment_received_email,
        args=(full_name, email, programme_label, amount_expected, transfer_reference),
    )
    t2 = threading.Thread(
        target=send_academy_notification_email,
        args=(full_name, email, programme_label, amount_expected, transfer_reference),
    )
    t1.start()
    t2.start()
    t1.join()
    t2.join()


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

    # Both emails go out together, right after the response is returned —
    # see _send_enrollment_emails for why this is one task with two threads
    # rather than two sequential BackgroundTasks.
    background_tasks.add_task(
        _send_enrollment_emails,
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


@router.delete("/enrollments/{enrollment_id}", response_model=EnrollmentDeleteResponse)
def delete_enrollment(
    enrollment_id: int, background_tasks: BackgroundTasks, x_admin_key: str = Header(...)
):
    """Admin-only. Permanently deletes an enrollment whose payment never got
    confirmed (spam, no transfer landed, wrong reference, etc.) and emails the
    student that they can re-apply. Irreversible — there's no undo, and it's
    scoped to `pending_verification` rows only: an already-`paid` enrollment
    can't be deleted this way, since the decline email would be false."""
    require_admin(x_admin_key)

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT status FROM enrollments WHERE id = %s", (enrollment_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Enrollment not found.")
        if existing["status"] != "pending_verification":
            raise HTTPException(
                status_code=400,
                detail="Only a pending (unconfirmed) enrollment can be deleted this way.",
            )

        cur.execute(
            "DELETE FROM enrollments WHERE id = %s RETURNING id, full_name, email, programme_label",
            (enrollment_id,),
        )
        row = cur.fetchone()
        conn.commit()
    finally:
        cur.close()
        conn.close()

    background_tasks.add_task(
        send_enrollment_declined_email, row["full_name"], row["email"], row["programme_label"]
    )

    return {"id": row["id"], "full_name": row["full_name"], "email": row["email"], "deleted": True}