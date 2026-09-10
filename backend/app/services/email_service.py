import requests

from app.config import (
    ACADEMY_NOTIFICATION_EMAIL,
    FROM_EMAIL,
    PAID_STUDENTS_WHATSAPP_LINK,
    RESEND_API_KEY,
    WHATSAPP_LINKS_BY_PROGRAMME,
)


def send_welcome_email(name: str, email: str) -> bool:
    """Sends a welcome email via Resend. Returns False (and logs) on failure
    rather than raising — registration should succeed even if the email
    step has a hiccup."""
    if not RESEND_API_KEY:
        print("No RESEND_API_KEY set — skipping email send.")
        return False

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
                "to": [email],
                "subject": "Welcome to ForgeAcademy!",
                "html": f"<p>Hi {name}, welcome to ForgeAcademy! Your registration is confirmed.</p>",
            },
            timeout=10,
        )
        return resp.status_code in (200, 201)
    except requests.RequestException as e:
        print(f"Email send failed: {e}")
        return False


def send_enrollment_received_email(name: str, email: str, programme_label: str, amount: float, reference: str) -> bool:
    """Sent right after someone submits their enrollment + transfer reference."""
    if not RESEND_API_KEY:
        print("No RESEND_API_KEY set — skipping email send.")
        return False

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
                "to": [email],
                "subject": "We've received your Forge Academy enrollment",
                "html": (
                    f"<p>Hi {name},</p>"
                    f"<p>We've received your enrollment for <strong>{programme_label}</strong> "
                    f"(₦{amount:,.0f}), with transfer reference <strong>{reference}</strong>.</p>"
                    f"<p>We'll verify your payment shortly and email you again once it's confirmed.</p>"
                ),
            },
            timeout=10,
        )
        return resp.status_code in (200, 201)
    except requests.RequestException as e:
        print(f"Email send failed: {e}")
        return False


def send_enrollment_verified_email(
    name: str, email: str, programme_label: str, programme_key: str
) -> bool:
    """Sent once you (the admin) manually confirm the transfer landed."""
    if not RESEND_API_KEY:
        print("No RESEND_API_KEY set — skipping email send.")
        return False

    # This programme's own group link, else the shared fallback. Never another
    # programme's link.
    group_link = WHATSAPP_LINKS_BY_PROGRAMME.get(programme_key, "") or PAID_STUDENTS_WHATSAPP_LINK
    if group_link:
        whatsapp_line = (
            f'<p>Join the paid students WhatsApp group to get started: '
            f'<a href="{group_link}">{group_link}</a></p>'
        )
    else:
        print(
            f"No WhatsApp link for programme '{programme_key}' and no fallback — "
            f"omitting group link from confirmation email."
        )
        whatsapp_line = ""

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
                "to": [email],
                "subject": "Your Forge Academy payment is confirmed 🎉",
                "html": (
                    f"<p>Hi {name},</p>"
                    f"<p>Your payment for <strong>{programme_label}</strong> has been verified. "
                    f"You're officially enrolled, welcome to Forge Academy!</p>"
                    f"{whatsapp_line}"
                ),
            },
            timeout=10,
        )
        return resp.status_code in (200, 201)
    except requests.RequestException as e:
        print(f"Email send failed: {e}")
        return False


def send_academy_notification_email(
    student_name: str, student_email: str, programme_label: str, amount: float, reference: str
) -> bool:
    """Internal heads-up to the academy that a new enrollment is waiting for
    payment verification. Recipient comes from ACADEMY_NOTIFICATION_EMAIL.
    Best-effort like the rest — never blocks the enrollment write."""
    if not RESEND_API_KEY:
        print("No RESEND_API_KEY set — skipping email send.")
        return False

    if not ACADEMY_NOTIFICATION_EMAIL:
        print("No ACADEMY_NOTIFICATION_EMAIL set — skipping academy notification.")
        return False

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
                "to": [ACADEMY_NOTIFICATION_EMAIL],
                "subject": f"New enrollment awaiting verification — {student_name}",
                "html": (
                    f"<p>A new enrollment has come in and is awaiting payment verification.</p>"
                    f"<ul>"
                    f"<li><strong>Name:</strong> {student_name}</li>"
                    f"<li><strong>Email:</strong> {student_email}</li>"
                    f"<li><strong>Programme:</strong> {programme_label}</li>"
                    f"<li><strong>Amount expected:</strong> ₦{amount:,.0f}</li>"
                    f"<li><strong>Transfer reference:</strong> {reference}</li>"
                    f"</ul>"
                    f"<p>Open the admin dashboard to confirm it once the transfer lands.</p>"
                ),
            },
            timeout=10,
        )
        return resp.status_code in (200, 201)
    except requests.RequestException as e:
        print(f"Email send failed: {e}")
        return False
