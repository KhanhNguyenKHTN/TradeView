import os
import sys
import smtplib
from email.message import EmailMessage
from datetime import datetime

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

FROM_EMAIL = os.environ.get("FROM_EMAIL")
APP_PASSWORD = os.environ.get("EMAIL_PASSWORD")
TO_EMAIL = os.environ.get("TO_EMAIL")

LOG_FILE = "/home/data/TaiChinh/deploy.log"

status = sys.argv[1] if len(sys.argv) > 1 else "UNKNOWN"

if not FROM_EMAIL or not APP_PASSWORD or not TO_EMAIL:
    print("Missing email environment variables")
    sys.exit(1)

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

msg = EmailMessage()
msg["From"] = FROM_EMAIL
msg["To"] = TO_EMAIL

if status == "SUCCESS":
    msg["Subject"] = "[TaiChinh] Deploy SUCCESS"
    msg.set_content(
        f"""TaiChinh deployment completed successfully.

Time: {now}
Server: ARM64
Status: SUCCESS
"""
    )

elif status == "FAILED":
    msg["Subject"] = "[TaiChinh] Deploy FAILED"

    log_tail = ""

    try:
        with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
            log_tail = "".join(lines[-100:])
    except Exception as e:
        log_tail = f"Could not read deploy log: {e}"

    msg.set_content(
        f"""TaiChinh deployment failed.

Time: {now}
Server: ARM64
Status: FAILED

Last 100 lines of deploy.log:

----------------------------------------
{log_tail}
----------------------------------------
"""
    )

else:
    msg["Subject"] = "[TaiChinh] Deploy Notification"
    msg.set_content(
        f"""Deployment status: {status}

Time: {now}
"""
    )

try:
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        smtp.login(FROM_EMAIL, APP_PASSWORD)
        smtp.send_message(msg)

    print(f"Email sent: {status}")

except Exception as e:
    print(f"Failed to send email: {e}")
    sys.exit(1)