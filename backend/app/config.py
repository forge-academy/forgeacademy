import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in your "
        "Neon pooled connection string."
    )