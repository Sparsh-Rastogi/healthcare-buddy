"""
BayMax Autonomous Monitoring Agent — LangChain ReAct Implementation.

Architecture:
  - Framework : LangChain ReAct (Reason + Act loop)
  - LLM       : Groq llama-3.3-70b-versatile
  - Tools     : 8 MongoDB-backed async tools
  - Limits    : max_iterations=4, max_execution_time=60s
  - API Key   : User DB record → env fallback (GROQ_API_KEY)

The agent is a silent background monitor. It is explicitly NOT a diagnostician.
All observations are purely analytical and objective.
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from langchain_core.tools import tool
from langchain_groq import ChatGroq

from app.ai.alert import dispatch_alert
from app.config import decrypt_key, get_settings
from app.db import collections as col

logger = logging.getLogger(__name__)
settings = get_settings()

# ══════════════════════════════════════════════════════════════════════════════
# AGENT PERSONA
# ══════════════════════════════════════════════════════════════════════════════

_AGENT_PERSONA = """\
You are BayMax, an autonomous background health monitoring agent for the \
Healthcare Buddy platform. You operate silently in the background, checking \
patient health metrics against doctor-defined thresholds.

YOUR MANDATE (strictly enforced):
  ✔  Monitor vitals trends against doctor-defined thresholds
  ✔  Check medication and lifestyle compliance status
  ✔  Dispatch calibrated alerts (info / warning / critical) when rules are breached
  ✔  Log all observations and reasoning to the activity log
  ✔  Update the patient's clinical summary after each cycle

YOUR HARD LIMITS (never cross these):
  ✘  Do NOT diagnose any medical condition
  ✘  Do NOT prescribe or recommend medications or treatments
  ✘  Do NOT give personalised medical advice
  ✘  Do NOT override or second-guess doctor instructions

Your tone is calm, precise, and clinical. Every statement must be data-driven \
and objective. You are a data pipeline, not a physician.\
"""

# ══════════════════════════════════════════════════════════════════════════════
# REACT PROMPT
# ══════════════════════════════════════════════════════════════════════════════

REACT_PROMPT = PromptTemplate.from_template(
    _AGENT_PERSONA
    + """

You have access to the following tools:

{tools}

Use EXACTLY this format — deviating will cause a parsing error:

Question: the monitoring task you must complete
Thought: think step-by-step about what to evaluate first
Action: the action to take, must be one of [{tool_names}]
Action Input: a JSON string with the tool's required parameters
Observation: the result of the action
... (Thought / Action / Action Input / Observation can repeat — max 4 iterations)
Thought: I have completed the monitoring cycle
Final Answer: a concise clinical summary of findings and actions taken

Begin!

Question: {input}
Thought:{agent_scratchpad}"""
)


# ══════════════════════════════════════════════════════════════════════════════
# TOOL DEFINITIONS
# Each tool accepts a JSON string as input and returns a plain string result.
# ══════════════════════════════════════════════════════════════════════════════

@tool
async def get_vitals_trend(json_input: str) -> str:
    """
    Fetch a patient's vitals readings over the last N days.
    Input JSON: {"user_id": "<id>", "days": 7}
    Returns a JSON array of vitals entries sorted oldest-to-newest.
    """
    try:
        params = json.loads(json_input)
        user_id: str = params["user_id"]
        days: int = int(params.get("days", 7))
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        return f'ERROR: Cannot parse input — {exc}. Expected: {{"user_id": "...", "days": 7}}'

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cursor = (
        col.vitals()
        .find({"user_id": user_id, "timestamp": {"$gte": cutoff}})
        .sort("timestamp", 1)
        .limit(50)
    )
    records = []
    async for doc in cursor:
        doc.pop("_id", None)
        records.append(doc)

    if not records:
        return f"No vitals data found for user {user_id} in the last {days} days."

    logger.info(f"[Tool:get_vitals_trend] user={user_id} days={days} → {len(records)} records")
    return json.dumps(records, default=str)


@tool
async def get_cycle_data(json_input: str) -> str:
    """
    Fetch the most recent menstrual cycle entries for a patient.
    Input JSON: {"user_id": "<id>"}
    Returns up to 5 recent cycle entries.
    """
    try:
        params = json.loads(json_input)
        user_id: str = params["user_id"]
    except (json.JSONDecodeError, KeyError) as exc:
        return f'ERROR: Cannot parse input — {exc}. Expected: {{"user_id": "..."}}'

    cursor = (
        col.cycle_logs()
        .find({"user_id": user_id})
        .sort("cycle_start", -1)
        .limit(5)
    )
    records = []
    async for doc in cursor:
        doc.pop("_id", None)
        records.append(doc)

    if not records:
        return f"No cycle data found for user {user_id}."

    logger.info(f"[Tool:get_cycle_data] user={user_id} → {len(records)} entries")
    return json.dumps(records, default=str)


@tool
async def check_compliance(json_input: str) -> str:
    """
    Check today's compliance status for a patient.
    Input JSON: {"user_id": "<id>"}
    Returns today's compliance entries with completed/pending breakdown.
    """
    try:
        params = json.loads(json_input)
        user_id: str = params["user_id"]
    except (json.JSONDecodeError, KeyError) as exc:
        return f'ERROR: Cannot parse input — {exc}. Expected: {{"user_id": "..."}}'

    today_str = datetime.now(timezone.utc).date().isoformat()
    cursor = col.compliance_logs().find({"user_id": user_id, "date": today_str})
    records = []
    completed = 0
    async for doc in cursor:
        doc.pop("_id", None)
        records.append(doc)
        if doc.get("completed"):
            completed += 1

    result = {
        "date": today_str,
        "total": len(records),
        "completed": completed,
        "pending": len(records) - completed,
        "entries": records,
    }
    logger.info(f"[Tool:check_compliance] user={user_id} completed={completed}/{len(records)}")
    return json.dumps(result, default=str)


@tool
async def mark_compliance(json_input: str) -> str:
    """
    Mark a compliance measure as completed for today.
    Input JSON: {"user_id": "<id>", "measure": "<measure_name>"}
    """
    try:
        params = json.loads(json_input)
        user_id: str = params["user_id"]
        measure: str = params["measure"]
    except (json.JSONDecodeError, KeyError) as exc:
        return f'ERROR: Cannot parse input — {exc}. Expected: {{"user_id": "...", "measure": "..."}}'

    today_str = datetime.now(timezone.utc).date().isoformat()
    now = datetime.now(timezone.utc)
    await col.compliance_logs().update_one(
        {"user_id": user_id, "date": today_str, "measure": measure},
        {"$set": {"completed": True, "updated_at": now}},
        upsert=True,
    )
    logger.info(f"[Tool:mark_compliance] user={user_id} measure={measure} → completed")
    return f"Compliance measure '{measure}' marked as completed for user {user_id} on {today_str}."


@tool
async def send_alert(json_input: str) -> str:
    """
    Dispatch a health alert for a patient.
    Input JSON: {"user_id": "<id>", "severity": "info|warning|critical", "message": "<text>"}
    - info     → logs to DB + console
    - warning  → logs + emails patient
    - critical → logs + emails patient + emails emergency contact
    """
    try:
        params = json.loads(json_input)
        user_id: str = params["user_id"]
        severity: str = params["severity"].lower()
        message: str = params["message"]
    except (json.JSONDecodeError, KeyError) as exc:
        return f'ERROR: Cannot parse input — {exc}. Expected: {{"user_id":"...","severity":"warning","message":"..."}}'

    if severity not in ("info", "warning", "critical"):
        return f"ERROR: Invalid severity '{severity}'. Must be: info | warning | critical"

    result = await dispatch_alert(user_id=user_id, severity=severity, message=message)
    logger.info(f"[Tool:send_alert] user={user_id} severity={severity}")
    return result


@tool
async def notify_emergency(json_input: str) -> str:
    """
    Directly notify a patient's emergency contact.
    Input JSON: {"user_id": "<id>", "message": "<urgent message>"}
    Use only for situations requiring immediate human intervention.
    """
    try:
        params = json.loads(json_input)
        user_id: str = params["user_id"]
        message: str = params["message"]
    except (json.JSONDecodeError, KeyError) as exc:
        return f'ERROR: Cannot parse input — {exc}. Expected: {{"user_id": "...", "message": "..."}}'

    result = await dispatch_alert(
        user_id=user_id, severity="critical", message=message, force_emergency=True
    )
    logger.warning(f"[Tool:notify_emergency] user={user_id} — emergency contact notified")
    return result


@tool
async def update_summary(json_input: str) -> str:
    """
    Update the patient's stored clinical summary.
    Input JSON: {"user_id": "<id>", "new_summary": "<clinical summary text>"}
    This summary is used by doctors and future agent cycles.
    """
    try:
        params = json.loads(json_input)
        user_id: str = params["user_id"]
        new_summary: str = params["new_summary"]
    except (json.JSONDecodeError, KeyError) as exc:
        return f'ERROR: Cannot parse input — {exc}. Expected: {{"user_id": "...", "new_summary": "..."}}'

    now = datetime.now(timezone.utc)
    await col.users().update_one(
        {"user_id": user_id},
        {"$set": {"last_agent_summary": new_summary, "summary_updated_at": now}},
    )
    logger.info(f"[Tool:update_summary] user={user_id} → summary updated")
    return f"Clinical summary updated for user {user_id} at {now.isoformat()}."


@tool
async def log_action(json_input: str) -> str:
    """
    Persist an agent action and its reasoning to the activity log.
    Input JSON: {"user_id": "<id>", "action": "<short label>", "reasoning": "<explanation>"}
    Always call this after any significant observation or decision.
    """
    try:
        params = json.loads(json_input)
        user_id: str = params["user_id"]
        action: str = params["action"]
        reasoning: str = params["reasoning"]
    except (json.JSONDecodeError, KeyError) as exc:
        return f'ERROR: Cannot parse input — {exc}. Expected: {{"user_id":"...","action":"...","reasoning":"..."}}'

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "timestamp": now,
        "action": action,
        "reasoning": reasoning,
        "tool_used": "log_action",
        "severity": "info",
        "result": "logged",
    }
    await col.agent_logs().insert_one(doc)
    logger.info(f"[Tool:log_action] user={user_id} | {action}")
    return f"Action '{action}' logged at {now.isoformat()}."


# ── Registered tool list ───────────────────────────────────────────────────────
AGENT_TOOLS = [
    get_vitals_trend,
    get_cycle_data,
    check_compliance,
    mark_compliance,
    send_alert,
    notify_emergency,
    update_summary,
    log_action,
]


# ══════════════════════════════════════════════════════════════════════════════
# API KEY RESOLVER
# ══════════════════════════════════════════════════════════════════════════════

async def _resolve_api_key(user_id: str) -> str:
    """
    Resolve the Groq API key for a user:
      1. Try to decrypt the stored key from the user's DB profile.
      2. Fall back to the server-side GROQ_API_KEY env variable.
    """
    user = await col.users().find_one({"user_id": user_id})
    if user and user.get("groq_api_key"):
        try:
            key = decrypt_key(user["groq_api_key"])
            if key:
                return key
        except Exception as exc:
            logger.warning(f"[Agent] Could not decrypt API key for {user_id}: {exc}")

    fallback = os.getenv("GROQ_API_KEY", "")
    if fallback:
        logger.info(f"[Agent] Using server fallback GROQ_API_KEY for user {user_id}")
    return fallback


# ══════════════════════════════════════════════════════════════════════════════
# AGENT RUNNER
# ══════════════════════════════════════════════════════════════════════════════

async def run_agent(
    user_id: str,
    context: dict,
    api_key: Optional[str] = None,
) -> dict:
    """
    Execute one autonomous monitoring cycle for a patient.

    Args:
        user_id : The patient's unique ID.
        context : Dict containing doctor_instructions, vitals_preview,
                  compliance, last_summary, etc.
        api_key : Optional explicit Groq API key. If None, resolves from DB/env.

    Returns:
        Dict with keys: success (bool), output (str), steps (int).
    """
    if not api_key:
        api_key = await _resolve_api_key(user_id)

    if not api_key:
        logger.error(f"[Agent] ❌ No API key for user {user_id} — skipping cycle.")
        return {"success": False, "output": "No API key available.", "steps": 0}

    llm = ChatGroq(
        api_key=api_key,
        model=settings.GROQ_MODEL,
        temperature=0.1,
        max_tokens=1024,
    )

    agent = create_react_agent(llm=llm, tools=AGENT_TOOLS, prompt=REACT_PROMPT)
    executor = AgentExecutor(
        agent=agent,
        tools=AGENT_TOOLS,
        max_iterations=4,               # Hard cap — prevents Groq RPM exhaustion
        max_execution_time=60,          # 60-second wall-clock timeout
        verbose=True,                   # Prints ReAct trace to stdout
        handle_parsing_errors=True,     # Recovers from LLM formatting mistakes
        return_intermediate_steps=True,
    )

    task = (
        f"Patient ID       : {user_id}\n"
        f"Doctor Rules     : {context.get('doctor_instructions', 'None provided')}\n"
        f"Vitals Preview   : {json.dumps(context.get('vitals_preview', []), default=str)}\n"
        f"Today Compliance : {json.dumps(context.get('compliance', {}), default=str)}\n"
        f"Prior Summary    : {context.get('last_summary', 'No prior summary')}\n\n"
        "TASK: Run a complete monitoring cycle. Steps:\n"
        "  1. Fetch the full vitals trend (last 7 days) via get_vitals_trend.\n"
        "  2. Check today's compliance via check_compliance.\n"
        "  3. Evaluate all metrics against the doctor's rules.\n"
        "  4. If any threshold is breached → send_alert with appropriate severity.\n"
        "  5. Log your reasoning via log_action.\n"
        "  6. Update the clinical summary via update_summary.\n"
        "Limit tool calls to 4 total. Be efficient."
    )

    print(f"\n{'═'*60}")
    print(f"  🤖  BayMax Agent Cycle — user={user_id}")
    print(f"{'═'*60}")

    try:
        result = await executor.ainvoke({"input": task})
        steps = len(result.get("intermediate_steps", []))
        output = result.get("output", "")
        logger.info(f"[Agent] ✅ Cycle complete for {user_id} in {steps} steps.")
        print(f"\n[BayMax] ✅ Cycle complete ({steps} tool calls)")
        print(f"[BayMax] Final: {output}\n")
        return {"success": True, "output": output, "steps": steps}

    except Exception as exc:
        logger.error(f"[Agent] ❌ Execution failed for {user_id}: {exc}", exc_info=True)
        return {"success": False, "output": str(exc), "steps": 0}
