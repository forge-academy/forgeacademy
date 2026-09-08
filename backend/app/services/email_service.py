import requests

from app.config import FROM_EMAIL, RESEND_API_KEY


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


def send_enrollment_verified_email(name: str, email: str, programme_label: str) -> bool:
    """Sent once you (the admin) manually confirm the transfer landed."""
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
                "subject": "Your Forge Academy payment is confirmed 🎉",
                "html": (
                    f"<p>Hi {name},</p>"
                    f"<p>Your payment for <strong>{programme_label}</strong> has been verified. "
                    f"You're officially enrolled, welcome to Forge Academy!</p>"
                ),
            },
            timeout=10,
        )
        return resp.status_code in (200, 201)
    except requests.RequestException as e:
        print(f"Email send failed: {e}")
        return False
