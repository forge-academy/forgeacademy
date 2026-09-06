import psycopg2

from app.config import DATABASE_URL


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    """Creates the users and enrollments tables if they don't exist yet. Runs once on startup."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT now()
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS enrollments (
            id SERIAL PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            programme_key TEXT NOT NULL,
            programme_label TEXT NOT NULL,
            amount_expected NUMERIC NOT NULL,
            referral_code TEXT,
            discount_pct NUMERIC DEFAULT 0,
            transfer_reference TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending_verification',
            created_at TIMESTAMP DEFAULT now(),
            verified_at TIMESTAMP
        )
        """
    )
    conn.commit()
    cur.close()
    conn.close()