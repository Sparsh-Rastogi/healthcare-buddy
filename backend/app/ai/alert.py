"""
BayMax Alert Dispatcher.

Severity routing:
  info     → Insert to agent_logs + print to console (stub)
  warning  → agent_logs + "email" patient (stubbed as console print)
  critical → agent_logs + "email" patient + "email" emergency contact

To activate real SendGrid emails, set SENDGRID_API_KEY in .env.
The stub logs clearly mark where the real API call would go.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from app.config import get_settings
from app.db import collections as col

logger = logging.getLogger(__name__)
settings = get_settings()

# ANSI colour codes for stdout clarity
_COLOURS = {
    "info": "\033[94m",       # Blue
    "warning": "\033[93m",    # Yellow
    "critical": "\033[91m",   # Red
    "reset": "\033[0m",
}


def _coloured(severity: str, text: str) -> str:
    c = _COLOURS.get(severity, "")
    return f"{c}{text}{_COLOURS['reset']}"


async def _send_email_stub(to_email: str, subject: str, body: str, severity: str) -> None:
    """
    Stubbed email sender.
    Prints a rich formatted alert to stdout.
    Replace this block with real SendGrid calls once SENDGRID_API_KEY is set.
    """
    sendgrid_key = settings.SENDGRID_API_KEY

    if sendgrid_key:
        # ── Real SendGrid path ─────────────────────────────────────────────
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=settings.SENDGRID_FROM_EMAIL,
                to_emails=to_email,
                subject=subject,
                plain_text_content=body,
            )
            sg = SendGridAPIClient(sendgrid_key)
            sg.send(message)
            logger.info(f"[Alert] ✉️  Email sent to {to_email} (severity={severity})")
        except Exception as exc:
            logger.error(f"[Alert] SendGrid failed: {exc}")
    else:
        # ── Stub path: log to console ──────────────────────────────────────
        banner = "═" * 60
        print(_coloured(severity, f"\n{banner}"))
        print(_coloured(severity, f"  📧  BAYMAX ALERT [{severity.upper()}]"))
        print(_coloured(severity, f"  To      : {to_email}"))
        print(_coloured(severity, f"  Subject : {subject}"))
        print(_coloured(severity, f"  Body    : {body}"))
        print(_coloured(severity, f"{banner}\n"))
        logger.warning(
            f"[Alert] ⚠️  SENDGRID_API_KEY not set — email stubbed to console. "
            f"Recipient={to_email}"
        )


async def dispatch_alert(
    user_id: str,
    severity: str,
    message: str,
    force_emergency: bool = False,
) -> str:
    """
    Dispatch an alert for a patient.

    Args:
        user_id: Patient's ID.
        severity: 'info' | 'warning' | 'critical'
        message: Human-readable alert message.
        force_emergency: If True, always notify emergency contact regardless of severity.

    Returns:
        A summary string describing what actions were taken.
    """
    severity = severity.lower()
    now = datetime.now(timezone.utc)
    actions_taken = []

    # ── 1. Always log to agent_logs ────────────────────────────────────────
    log_doc = {
        "user_id": user_id,
        "timestamp": now,
        "action": f"alert_dispatched:{severity}",
        "reasoning": message,
        "severity": severity,
        "tool_used": "send_alert",
        "result": "logged",
    }
    await col.agent_logs().insert_one(log_doc)
    actions_taken.append("logged_to_db")

    # Console trace (always visible)
    print(_coloured(severity, f"\n[BayMax Alert | {severity.upper()}] {message}"))
    logger.info(f"[Alert] user={user_id} severity={severity} | {message}")

    # ── 2. Fetch user profile for email targets ────────────────────────────
    profile = await col.users().find_one({"user_id": user_id})
    patient_email = profile.get("email") if profile else None
    emergency_email = profile.get("emergency_contact") if profile else None

    subject_prefix = {
        "info": "ℹ️  BayMax Health Update",
        "warning": "⚠️  BayMax Health Warning",
        "critical": "🚨 BayMax Critical Alert",
    }.get(severity, "BayMax Alert")

    # ── 3. Warning → email patient ─────────────────────────────────────────
    if severity in ("warning", "critical") and patient_email:
        await _send_email_stub(
            to_email=patient_email,
            subject=f"{subject_prefix} — Action Required",
            body=f"Dear {profile.get('name', 'Patient')},\n\nBayMax has detected the following:\n\n{message}\n\nPlease consult your healthcare provider.\n\n— BayMax Health Monitor",
            severity=severity,
        )
        actions_taken.append(f"emailed_patient:{patient_email}")

    # ── 4. Critical (or force_emergency) → also email emergency contact ───
    if (severity == "critical" or force_emergency) and emergency_email:
        await _send_email_stub(
            to_email=emergency_email,
            subject=f"🚨 BayMax CRITICAL ALERT for {profile.get('name', 'Patient')}",
            body=f"This is an automated critical health alert from BayMax.\n\nPatient: {profile.get('name', user_id)}\n\nAlert: {message}\n\nPlease check on the patient immediately and contact their healthcare provider.\n\n— BayMax Autonomous Monitor",
            severity="critical",
        )
        actions_taken.append(f"emailed_emergency:{emergency_email}")

    result_summary = f"Alert dispatched. Actions: {', '.join(actions_taken)}."
    logger.info(f"[Alert] {result_summary}")
    return result_summary
