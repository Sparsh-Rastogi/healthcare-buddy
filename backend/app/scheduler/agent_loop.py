"""
BayMax Background Agent Loop — APScheduler.

Runs every AGENT_LOOP_INTERVAL_MINUTES minutes (default: 15).
For each active user profile, loads context and triggers one agent cycle.

Rate-limit safety:
  - 15-second asyncio.sleep() between user evaluations to respect Groq RPM.
  - Agent itself is capped at max_iterations=4 and max_execution_time=60s.

Exposed via POST /admin/run-agent for on-demand testing (dev mode only).
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_scheduler: AsyncIOScheduler | None = None

# ─── Pacing delay between users (seconds) ─────────────────────────────────────
_INTER_USER_DELAY_SECONDS = 15


# ══════════════════════════════════════════════════════════════════════════════
# CONTEXT BUILDER
# ══════════════════════════════════════════════════════════════════════════════

async def _build_user_context(user_id: str, profile: dict) -> dict:
    """
    Assemble the monitoring context for a single user.
    Fetches a lightweight vitals preview (last 3 entries) to reduce
    tokens in the agent's task prompt.
    """
    from app.db import collections as col
    from datetime import date

    # Quick vitals preview (last 3 readings — agent fetches full trend itself)
    cursor = (
        col.vitals()
        .find({"user_id": user_id})
        .sort("timestamp", -1)
        .limit(3)
    )
    vitals_preview = []
    async for doc in cursor:
        doc.pop("_id", None)
        vitals_preview.append(doc)

    # Today's compliance summary
    today_str = date.today().isoformat()
    cursor = col.compliance_logs().find({"user_id": user_id, "date": today_str})
    compliance_entries = []
    async for doc in cursor:
        doc.pop("_id", None)
        compliance_entries.append(doc)

    return {
        "doctor_instructions": profile.get("doctor_instructions", "No instructions provided."),
        "conditions": profile.get("conditions", []),
        "medications": profile.get("medications", []),
        "vitals_preview": vitals_preview,
        "compliance": {
            "date": today_str,
            "entries": compliance_entries,
        },
        "last_summary": profile.get("last_agent_summary", "No prior summary."),
    }


# ══════════════════════════════════════════════════════════════════════════════
# MAIN JOB
# ══════════════════════════════════════════════════════════════════════════════

async def _run_monitoring_loop() -> None:
    """
    APScheduler job — runs every N minutes.
    Iterates all active users and fires one agent cycle per user,
    with a 15-second delay between each to protect Groq rate limits.
    """
    from app.db import collections as col
    from app.ai.agent import run_agent

    logger.info("=" * 60)
    logger.info("  🤖  BayMax Monitoring Loop — Starting")
    logger.info(f"  🕐  Time: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 60)

    # Fetch all active user profiles
    cursor = col.users().find({"is_active": True})
    users = []
    async for doc in cursor:
        users.append(doc)

    if not users:
        logger.info("[Scheduler] No active users found — loop idle.")
        return

    logger.info(f"[Scheduler] Processing {len(users)} active user(s).")

    for idx, profile in enumerate(users):
        user_id: str = profile.get("user_id", "")
        if not user_id:
            continue

        logger.info(f"[Scheduler] [{idx + 1}/{len(users)}] Evaluating user: {user_id}")

        try:
            context = await _build_user_context(user_id, profile)
            result = await run_agent(user_id=user_id, context=context)

            if result["success"]:
                logger.info(
                    f"[Scheduler] ✅ user={user_id} | "
                    f"steps={result['steps']} | output={result['output'][:120]}…"
                )
            else:
                logger.warning(
                    f"[Scheduler] ⚠️  user={user_id} | Failed: {result['output']}"
                )

        except Exception as exc:
            logger.error(f"[Scheduler] ❌ Exception for user {user_id}: {exc}", exc_info=True)

        # ── 15-second pacing delay between users ────────────────────────────
        if idx < len(users) - 1:
            logger.info(
                f"[Scheduler] ⏳ Waiting {_INTER_USER_DELAY_SECONDS}s before next user "
                f"(Groq RPM protection)…"
            )
            await asyncio.sleep(_INTER_USER_DELAY_SECONDS)

    logger.info("[Scheduler] 🏁 Monitoring loop complete.")


# ══════════════════════════════════════════════════════════════════════════════
# SCHEDULER LIFECYCLE
# ══════════════════════════════════════════════════════════════════════════════

def start_scheduler() -> None:
    """Start the APScheduler async background scheduler. Called on FastAPI startup."""
    global _scheduler
    interval_minutes = settings.AGENT_LOOP_INTERVAL_MINUTES

    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        _run_monitoring_loop,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="baymax_monitoring_loop",
        name="BayMax Autonomous Monitoring",
        replace_existing=True,
        max_instances=1,        # Never run two loop instances simultaneously
        misfire_grace_time=60,  # Allow 60s late start before skipping
    )
    _scheduler.start()
    logger.info(
        f"[Scheduler] ✅ BayMax monitoring loop started "
        f"(every {interval_minutes} minutes, 1 instance max)."
    )


def stop_scheduler() -> None:
    """Gracefully stop the scheduler. Called on FastAPI shutdown."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[Scheduler] 🛑 Monitoring loop stopped.")


async def run_single_cycle(user_id: str) -> dict:
    """
    Force-run a single monitoring cycle for one user.
    Used by POST /admin/run-agent for testing.
    """
    from app.db import collections as col
    from app.ai.agent import run_agent

    profile = await col.users().find_one({"user_id": user_id})
    if not profile:
        return {"success": False, "output": f"User '{user_id}' not found.", "steps": 0}

    context = await _build_user_context(user_id, profile)
    return await run_agent(user_id=user_id, context=context)
