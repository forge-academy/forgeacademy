from fastapi import APIRouter, Request

from app.database import get_connection
from app.rate_limit import limiter
from app.schemas import PageViewCreate, TrackResponse

router = APIRouter(prefix="/api", tags=["analytics"])


@router.post("/track", response_model=TrackResponse)
@limiter.limit("60/minute")
def track_page_view(request: Request, payload: PageViewCreate):
    """Public. Logs one pageview, fired by the fire-and-forget beacon in
    public/analytics/track.js on every page load. Same best-effort philosophy
    as email sending elsewhere in this codebase: a failure here must never
    surface as an error to the visitor, so every exception is swallowed and
    this always responds 200."""
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO page_views (path, referrer, visitor_id)
            VALUES (%s, %s, %s)
            """,
            (payload.path, payload.referrer, payload.visitor_id),
        )
        conn.commit()
        cur.close()
        return {"ok": True}
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[analytics] failed to record page view: {e}")
        return {"ok": False}
    finally:
        if conn:
            conn.close()
