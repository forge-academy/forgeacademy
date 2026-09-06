from fastapi import APIRouter, HTTPException, Header
from psycopg2.extras import RealDictCursor

from app.database import get_connection
from app.schemas import EnrollmentCreateRequest, EnrollmentResponse
from app.config import ADMIN_KEY

router = APIRouter(prefix="/api", tags=["enrollments"])


@router.post("/enrollments", response_model=EnrollmentResponse)
def create_enrollment(payload: EnrollmentCreateRequest):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            INSERT INTO enrollments
              (full_name, email, phone, programme_key, programme_label,
               amount_expected, referral_code, discount_pct, transfer_reference)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                payload.transfer_reference,
            ),
        )
        row = cur.fetchone()
        conn.commit()
    finally:
        cur.close()
        conn.close()

    return row


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
        RETURNING id, full_name, email, programme_label, amount_expected, status, created_at
        """,
        (enrollment_id,),
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Enrollment not found.")
    return row