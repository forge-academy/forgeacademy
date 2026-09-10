import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")
ADMIN_KEY = os.getenv("ADMIN_KEY", "")

# Address that gets pinged whenever a new enrollment comes in, so the admin
# knows to open the dashboard and verify a transfer. Empty -> notification skipped.
ACADEMY_NOTIFICATION_EMAIL = os.getenv("ACADEMY_NOTIFICATION_EMAIL", "")

# Per-programme paid-students WhatsApp group links, included in the payment
# confirmation email. PAID_STUDENTS_WHATSAPP_LINK is the fallback when a
# programme has no link of its own. All empty -> the link line is omitted.
PAID_STUDENTS_WHATSAPP_LINK = os.getenv("PAID_STUDENTS_WHATSAPP_LINK", "")
WHATSAPP_LINK_UIUX = os.getenv("WHATSAPP_LINK_UIUX", "")
WHATSAPP_LINK_DATA = os.getenv("WHATSAPP_LINK_DATA", "")
WHATSAPP_LINK_SWE = os.getenv("WHATSAPP_LINK_SWE", "")

# programme_key -> its group link. Add a row here to support a new programme.
WHATSAPP_LINKS_BY_PROGRAMME = {
    "uiux": WHATSAPP_LINK_UIUX,
    "data": WHATSAPP_LINK_DATA,
    "swe": WHATSAPP_LINK_SWE,
}

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in your "
        "Neon pooled connection string."
    )