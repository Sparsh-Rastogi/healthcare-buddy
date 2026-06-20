"""
Google Calendar integration — Service Account based.

Triggered when a user's doctor_instructions are updated.
Parses instructions for frequency keywords and creates RRULE-based
recurring events in the patient's Google Calendar.

Note: For a service account to write to a user's calendar, the user must
share their calendar with the service account email, OR domain-wide delegation
must be configured in Google Workspace.
"""

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── Keyword → RRULE frequency mapping ───────────────────────────────────────
_FREQUENCY_MAP = {
    re.compile(r"daily|every day|once a day", re.I): ("DAILY", 1),
    re.compile(r"twice a day|2x daily|bid", re.I): ("DAILY", 2),
    re.compile(r"every (morning|evening|night)", re.I): ("DAILY", 1),
    re.compile(r"weekly|once a week", re.I): ("WEEKLY", 1),
    re.compile(r"every other day|alternate days", re.I): ("DAILY", 1),  # simplified
}

# ─── Measurement keywords → event titles ─────────────────────────────────────
_MEASURE_MAP = {
    re.compile(r"blood pressure|bp|systolic", re.I): "Blood Pressure Reading",
    re.compile(r"blood glucose|blood sugar|glucose", re.I): "Blood Glucose Check",
    re.compile(r"weight|weigh", re.I): "Weight Measurement",
    re.compile(r"medication|medicine|drug|pill", re.I): "Take Medication",
    re.compile(r"exercise|walk|steps", re.I): "Daily Exercise",
    re.compile(r"temperature|temp", re.I): "Temperature Check",
    re.compile(r"oxygen|spo2|pulse ox", re.I): "SpO2 Check",
}


def _parse_reminders(doctor_instructions: str) -> List[dict]:
    """
    Parse doctor instructions text into a list of reminder configs.
    Returns list of {"title": str, "rrule": str}.
    """
    reminders = []
    for measure_pat, title in _MEASURE_MAP.items():
        if measure_pat.search(doctor_instructions):
            # Determine frequency
            freq, count = "DAILY", 1
            for freq_pat, (f, c) in _FREQUENCY_MAP.items():
                if freq_pat.search(doctor_instructions):
                    freq, count = f, c
                    break
            reminders.append({"title": title, "rrule": f"RRULE:FREQ={freq};COUNT=90"})

    if not reminders:
        # Fallback: generic daily health check reminder
        reminders.append({
            "title": "Daily Health Check — BayMax",
            "rrule": "RRULE:FREQ=DAILY;COUNT=90",
        })
    return reminders


def _get_calendar_service(delegated_email: Optional[str] = None):
    """Build an authenticated Google Calendar service."""
    sa_json = settings.GOOGLE_SERVICE_ACCOUNT_JSON
    if not sa_json:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not configured.")

    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    sa_info = json.loads(sa_json)
    scopes = ["https://www.googleapis.com/auth/calendar"]
    credentials = service_account.Credentials.from_service_account_info(sa_info, scopes=scopes)

    # Domain-wide delegation — impersonate the patient's Google account
    if delegated_email:
        credentials = credentials.with_subject(delegated_email)

    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


async def schedule_doctor_reminders(user_id: str, doctor_instructions: str) -> List[str]:
    """
    Parse doctor instructions and create recurring Google Calendar reminders.

    Args:
        user_id             : Patient's ID (used for logging).
        doctor_instructions : Free-text rules from the doctor.

    Returns:
        List of created Google Calendar event IDs.
    """
    import asyncio

    reminders = _parse_reminders(doctor_instructions)
    if not reminders:
        return []

    # Fetch patient's email for calendar delegation
    from app.db import collections as col
    profile = await col.users().find_one({"user_id": user_id})
    patient_email = profile.get("email") if profile else None

    try:
        service = _get_calendar_service(delegated_email=patient_email)
    except Exception as exc:
        logger.warning(f"[Calendar] Cannot build service: {exc}")
        return []

    calendar_id = settings.GOOGLE_CALENDAR_ID
    start_dt = datetime.now(timezone.utc) + timedelta(days=1)
    start_dt = start_dt.replace(hour=8, minute=0, second=0, microsecond=0)

    created_ids = []

    def _create_event(reminder: dict) -> Optional[str]:
        event_body = {
            "summary": f"🏥 {reminder['title']} — BayMax",
            "description": (
                f"Scheduled by BayMax based on your doctor's instructions.\n\n"
                f"Instructions: {doctor_instructions[:300]}"
            ),
            "start": {
                "dateTime": start_dt.isoformat(),
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": (start_dt + timedelta(minutes=15)).isoformat(),
                "timeZone": "UTC",
            },
            "recurrence": [reminder["rrule"]],
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 15},
                    {"method": "email", "minutes": 60},
                ],
            },
        }
        try:
            created = service.events().insert(calendarId=calendar_id, body=event_body).execute()
            event_id = created.get("id", "")
            logger.info(f"[Calendar] ✅ Created event '{reminder['title']}' id={event_id}")
            return event_id
        except Exception as exc:
            logger.error(f"[Calendar] Failed to create event '{reminder['title']}': {exc}")
            return None

    loop = asyncio.get_event_loop()
    for reminder in reminders:
        event_id = await loop.run_in_executor(None, lambda r=reminder: _create_event(r))
        if event_id:
            created_ids.append(event_id)

    return created_ids
