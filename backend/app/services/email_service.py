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