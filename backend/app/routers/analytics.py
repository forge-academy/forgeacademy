from fastapi import APIRouter, Header, Query, Request
from psycopg2.extras import RealDictCursor

from app.database import get_connection
from app.rate_limit import limiter
from app.routers.enrollments import require_admin
from app.schemas import AnalyticsSummary, PageViewCreate, TrackResponse

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


@router.get("/analytics", response_model=AnalyticsSummary)
@limiter.limit("30/minute")
def get_analytics(
    request: Request,
    x_admin_key: str = Header(...),
    days: int = Query(30, ge=1, le=90),
):
    """Admin only, same gate as the enrollments dashboard. Feeds the
    analytics dashboard at public/analytics/dashboard.html. Not called by
    any public page."""
    require_admin(x_admin_key)

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT
                COUNT(*) AS total_views,
                COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) AS unique_visitors
            FROM page_views
            WHERE created_at >= now() - (%s * interval '1 day')
            """,
            (days,),
        )
        totals = cur.fetchone()

        cur.execute(
            """
            SELECT path, COUNT(*) AS views
            FROM page_views
            WHERE created_at >= now() - (%s * interval '1 day')
            GROUP BY path
            ORDER BY views DESC
            LIMIT 15
            """,
            (days,),
        )
        views_by_page = cur.fetchall()

        cur.execute(
            """
            SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date, COUNT(*) AS views
            FROM page_views
            WHERE created_at >= now() - (%s * interval '1 day')
            GROUP BY date_trunc('day', created_at)
            ORDER BY date_trunc('day', created_at)
            """,
            (days,),
        )
        views_by_day = cur.fetchall()

        cur.execute(
            """
            SELECT COALESCE(NULLIF(referrer, ''), 'Direct') AS referrer, COUNT(*) AS views
            FROM page_views
            WHERE created_at >= now() - (%s * interval '1 day')
            GROUP BY 1
            ORDER BY views DESC
            LIMIT 10
            """,
            (days,),
        )
        top_referrers = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    return {
        "total_views": totals["total_views"] or 0,
        "unique_visitors": totals["unique_visitors"] or 0,
        "views_by_page": views_by_page,
        "views_by_day": views_by_day,
        "top_referrers": top_referrers,
    }
