"""
Compliance routes.
POST /api/v1/compliance/log     — Log a compliance measure
GET  /api/v1/compliance/status  — Today's compliance summary
GET  /api/v1/compliance/history — Historical compliance entries
"""

import logging
from datetime import date, datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Query, status

from app.db import collections as col
from app.middleware.auth import get_current_user
from app.models.compliance import (
    ComplianceLogCreate,
    ComplianceLogResponse,
    ComplianceStatusResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/compliance", tags=["Compliance"])


def _doc_to_response(doc: dict) -> ComplianceLogResponse:
    doc["id"] = str(doc.pop("_id", ""))
    return ComplianceLogResponse(**doc)


@router.post("/log", response_model=ComplianceLogResponse, status_code=status.HTTP_201_CREATED)
async def log_compliance(
    body: ComplianceLogCreate,
    user_id: str = Depends(get_current_user),
):
    """Log or update a compliance task for today (or a specified date)."""
    now = datetime.now(timezone.utc)
    log_date = body.log_date or date.today()
    date_str = log_date.isoformat()

    doc = body.model_dump(exclude_none=True)
    doc.pop("log_date", None)
    doc.update({"user_id": user_id, "date": date_str, "logged_at": now})

    # Upsert so re-logging the same measure on the same day updates it
    await col.compliance_logs().update_one(
        {"user_id": user_id, "date": date_str, "measure": body.measure},
        {"$set": doc},
        upsert=True,
    )
    saved = await col.compliance_logs().find_one(
        {"user_id": user_id, "date": date_str, "measure": body.measure}
    )
    return _doc_to_response(saved)


@router.get("/status", response_model=ComplianceStatusResponse)
async def get_compliance_status(user_id: str = Depends(get_current_user)):
    """Return today's compliance summary for the authenticated user."""
    today_str = date.today().isoformat()
    cursor = col.compliance_logs().find({"user_id": user_id, "date": today_str})
    entries = []
    completed = 0
    async for doc in cursor:
        entry = _doc_to_response(doc)
        entries.append(entry)
        if entry.completed:
            completed += 1

    pending = [e.measure for e in entries if not e.completed]
    return ComplianceStatusResponse(
        user_id=user_id,
        date=today_str,
        total_entries=len(entries),
        completed_count=completed,
        pending_measures=pending,
        entries=entries,
    )


@router.get("/history", response_model=List[ComplianceLogResponse])
async def get_compliance_history(
    user_id: str = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Return paginated compliance history, newest first."""
    skip = (page - 1) * page_size
    cursor = (
        col.compliance_logs()
        .find({"user_id": user_id})
        .sort("logged_at", -1)
        .skip(skip)
        .limit(page_size)
    )
    docs = []
    async for doc in cursor:
        docs.append(_doc_to_response(doc))
    return docs
