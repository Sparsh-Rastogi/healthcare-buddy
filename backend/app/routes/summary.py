"""
Doctor summary generator routes.
POST /api/v1/summary/generate — Generate a doctor-ready clinical summary
GET  /api/v1/summary/latest   — Fetch the most recent stored summary
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import collections as col
from app.middleware.auth import get_current_user
from app.config import get_settings, decrypt_key
from app.ai.agent import _resolve_api_key
import os

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/summary", tags=["Doctor Summary"])


@router.post("/generate", status_code=status.HTTP_200_OK)
async def generate_summary(user_id: str = Depends(get_current_user)):
    """
    Generate a structured clinical summary for the authenticated patient.
    Aggregates vitals trend, compliance, cycle data, and prior summaries,
    then sends to Groq LLM for a doctor-readable report.
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage
    from datetime import timedelta

    settings = get_settings()
    api_key = await _resolve_api_key(user_id)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No Groq API key available. Add one to your profile.",
        )

    # Gather context
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

    import json
    prompt = f"""Generate a professional, structured clinical summary for a doctor's review.

Patient: {profile.get('name', 'Unknown')}
Doctor Instructions: {profile.get('doctor_instructions', 'None')}
Recent Vitals (last 14 days): {json.dumps(vitals_data, default=str)}
Today's Compliance: {json.dumps(compliance_data, default=str)}
Cycle Data: {json.dumps(cycle_data, default=str)}
Prior Summary: {profile.get('last_agent_summary', 'None')}

Structure the output as:
1. Vitals Overview (trends, averages, anomalies)
2. Compliance Status
3. Relevant Cycle Notes (if applicable)
4. Key Observations
5. Suggested Follow-up Points (NOT diagnoses)

Important: Do NOT diagnose. Present only objective observations and data trends."""

    llm = ChatGroq(api_key=api_key, model=settings.GROQ_MODEL, temperature=0.2, max_tokens=1500)
    messages = [
        SystemMessage(content="You are BayMax, a clinical data summarization assistant. Your summaries are factual, objective, and structured for physician review."),
        HumanMessage(content=prompt),
    ]

    try:
        response = await llm.ainvoke(messages)
        summary_text = response.content
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM error: {exc}")

    # Save to user profile
    now = datetime.now(timezone.utc)
    await col.users().update_one(
        {"user_id": user_id},
        {"$set": {"last_agent_summary": summary_text, "summary_updated_at": now}},
    )

    return {
        "user_id": user_id,
        "generated_at": now.isoformat(),
        "summary": summary_text,
    }


@router.get("/latest")
async def get_latest_summary(user_id: str = Depends(get_current_user)):
    """Fetch the most recently generated clinical summary."""
    profile = await col.users().find_one({"user_id": user_id}, {"last_agent_summary": 1, "summary_updated_at": 1})
    if not profile or not profile.get("last_agent_summary"):
        raise HTTPException(status_code=404, detail="No summary available. Run /summary/generate first.")
    return {
        "user_id": user_id,
        "updated_at": profile.get("summary_updated_at"),
        "summary": profile["last_agent_summary"],
    }
