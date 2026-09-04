import psycopg2

from app.config import DATABASE_URL


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    """Creates the users table if it doesn't exist yet. Runs once on startup."""
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
    conn.commit()
    cur.close()
    conn.close()