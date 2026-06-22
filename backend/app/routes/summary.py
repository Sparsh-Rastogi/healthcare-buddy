"""
Doctor summary generator routes.
POST /api/v1/summary/generate — Generate a doctor-ready clinical summary
GET  /api/v1/summary/latest   — Fetch the most recent stored summary
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import collections as col
from app.middleware.auth import get_current_user
from app.config import get_settings
from app.ai.agent import _resolve_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/summary", tags=["Doctor Summary"])

_SYSTEM_MESSAGE = """You are BayMax, a precise clinical documentation assistant preparing a summary for physician review.

FORMATTING RULES (strictly enforced):
- Output ONLY well-structured GitHub-Flavored Markdown.
- Use `##` for every top-level section heading (with the emoji prefix provided).
- Use `###` for sub-headings within a section.
- Use `**bold**` for field labels (e.g. **Name:**, **Average:**).
- Use bullet points (`-`) for all list data. Never write plain-text paragraphs for structured data.
- Every section MUST have at least one bullet point, even if it says `- None recorded`.
- Separate each section with a blank line.
- Do NOT add any preamble, greeting, or closing remarks outside the defined sections.
- Do NOT diagnose. Present only objective observations and data-driven patterns."""


@router.post("/generate", status_code=status.HTTP_200_OK)
async def generate_summary(user_id: str = Depends(get_current_user)):
    """
    Generate a structured, Markdown-formatted clinical summary for the authenticated patient.
    Aggregates vitals, compliance, cycle data, recent chat history, and prior summaries,
    then sends to Groq LLM for a well-structured doctor-readable report.
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage

    settings = get_settings()
    api_key = await _resolve_api_key(user_id)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No Groq API key available. Add one to your profile.",
        )

    # ── Gather context ────────────────────────────────────────────────────────
    profile = await col.users().find_one({"user_id": user_id}) or {}

    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    vitals_cursor = (
        col.vitals()
        .find({"user_id": user_id, "timestamp": {"$gte": cutoff}})
        .sort("timestamp", -1)
        .limit(30)
    )
    vitals_data = []
    async for v in vitals_cursor:
        v.pop("_id", None)
        vitals_data.append(v)

    today_str = datetime.now(timezone.utc).date().isoformat()
    compliance_cursor = col.compliance_logs().find({"user_id": user_id, "date": today_str})
    compliance_data = []
    async for c in compliance_cursor:
        c.pop("_id", None)
        compliance_data.append(c)

    cycle_cursor = col.cycle_logs().find({"user_id": user_id}).sort("cycle_start", -1).limit(3)
    cycle_data = []
    async for cy in cycle_cursor:
        cy.pop("_id", None)
        cycle_data.append(cy)

    # ── Pull recent chat history to enrich summary ────────────────────────────
    chat_cursor = (
        col.chat_history()
        .find({"user_id": user_id})
        .sort("timestamp", -1)
        .limit(20)
    )
    chat_messages = []
    async for msg in chat_cursor:
        msg.pop("_id", None)
        chat_messages.append({"role": msg.get("role", ""), "content": msg.get("content", "")})
    chat_messages.reverse()  # chronological order

    # ── Build prompt ──────────────────────────────────────────────────────────
    has_cycle = bool(cycle_data)
    cycle_section = "\nCycle Data: " + json.dumps(cycle_data, default=str) if has_cycle else ""

    chat_context = "\n".join(
        f"[{m['role'].upper()}]: {m['content'][:300]}"
        for m in chat_messages
        if m.get("content")
    ) or "No recent chat messages."

    prompt = f"""Generate a clinical summary using EXACTLY the section headings below, in order.
Do not add, remove, or rename sections. Every section uses a `##` heading.

--- PATIENT DATA ---
Name: {profile.get('name', 'Unknown')}
Age / Gender: {profile.get('age', 'N/A')} / {profile.get('gender', 'N/A')}
Conditions: {', '.join(profile.get('conditions', [])) or 'None recorded'}
Medications: {json.dumps(profile.get('medications', []), default=str) if profile.get('medications') else 'None recorded'}
Doctor Instructions: {profile.get('doctor_instructions', 'None')}
Recent Vitals (last 14 days): {json.dumps(vitals_data, default=str)}
Today's Compliance: {json.dumps(compliance_data, default=str)}{cycle_section}
Prior Agent Summary: {profile.get('last_agent_summary', 'None')}

--- RECENT CHAT CONTEXT (last 20 messages between patient and BayMax) ---
{chat_context}

--- REQUIRED OUTPUT SECTIONS ---

## 🩺 Patient Profile
(Name, Age, Gender, City — use **Label:** format)

## 🏥 Active Conditions
(Bullet list of all recorded conditions)

## 💊 Current Medications
(Bullet list: **Name** — dosage, time)

## 📊 Vitals Overview
### Trends
(Average values per metric over the last 14 days)
### Anomalies
(Any readings outside normal range — if none, state that)

## ✅ Compliance Status
(Today's medication/task compliance — completed vs. pending)

{'## 🔄 Cycle Notes' if has_cycle else ''}
{'(Recent cycle data, symptoms)' if has_cycle else ''}

## 💬 Key Observations from Chat
(Summarise any health concerns, symptoms, or lifestyle issues the patient mentioned in recent chat conversations. If nothing relevant, write: - No notable health disclosures in recent chat.)

## 🔍 Suggested Follow-up Points
(Data-driven points for physician attention — NOT diagnoses)

## ⚠️ Disclaimer
- This summary was generated by BayMax AI for informational purposes only.
- It does not constitute a medical diagnosis or clinical advice.
- Always verify data with the patient directly before making clinical decisions."""

    # ── Call LLM ──────────────────────────────────────────────────────────────
    llm = ChatGroq(
        api_key=api_key,
        model=settings.GROQ_MODEL,
        temperature=0.15,
        max_tokens=2000,
    )
    messages = [
        SystemMessage(content=_SYSTEM_MESSAGE),
        HumanMessage(content=prompt),
    ]

    try:
        response = await llm.ainvoke(messages)
        summary_text = response.content
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM error: {exc}")

    # ── Persist ───────────────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    await col.users().update_one(
        {"user_id": user_id},
        {"$set": {"last_agent_summary": summary_text, "summary_updated_at": now}},
    )
    logger.info(f"[Summary] Generated for user={user_id} ({len(summary_text)} chars)")

    return {
        "user_id": user_id,
        "generated_at": now.isoformat(),
        "summary": summary_text,
    }


@router.get("/latest")
async def get_latest_summary(user_id: str = Depends(get_current_user)):
    """Fetch the most recently generated clinical summary."""
    profile = await col.users().find_one(
        {"user_id": user_id},
        {"last_agent_summary": 1, "summary_updated_at": 1}
    )
    if not profile or not profile.get("last_agent_summary"):
        raise HTTPException(
            status_code=404,
            detail="No summary available. Run /summary/generate first."
        )
    return {
        "user_id": user_id,
        "updated_at": profile.get("summary_updated_at"),
        "summary": profile["last_agent_summary"],
    }
