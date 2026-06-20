"""
Vitals routes.
POST /api/v1/vitals/log      — Log a new vitals entry
GET  /api/v1/vitals/history  — Paginated vitals history
GET  /api/v1/vitals/trend    — Last N days of data (for agent & charts)
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Query, status

from app.db import collections as col
from app.middleware.auth import get_current_user
from app.models.vitals import VitalsLog, VitalsResponse, VitalsTrendResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vitals", tags=["Vitals"])


def _doc_to_response(doc: dict) -> VitalsResponse:
    doc["id"] = str(doc.pop("_id", ""))
    return VitalsResponse(**doc)


@router.post("/log", response_model=VitalsResponse, status_code=status.HTTP_201_CREATED)
async def log_vitals(
    body: VitalsLog,
    user_id: str = Depends(get_current_user),
):
    """Log a new vitals reading for the authenticated patient."""
    now = datetime.now(timezone.utc)
    doc = body.model_dump(exclude_none=True)
    doc.update({"user_id": user_id, "timestamp": now})
    result = await col.vitals().insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return VitalsResponse(**doc)


@router.get("/history", response_model=List[VitalsResponse])
async def get_vitals_history(
    user_id: str = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Return paginated vitals history, newest first."""
    skip = (page - 1) * page_size
    cursor = (
        col.vitals()
        .find({"user_id": user_id})
        .sort("timestamp", -1)
        .skip(skip)
        .limit(page_size)
    )
    docs = []
    async for doc in cursor:
        docs.append(_doc_to_response(doc))
    return docs


@router.get("/trend", response_model=VitalsTrendResponse)
async def get_vitals_trend(
    user_id: str = Depends(get_current_user),
    days: int = Query(7, ge=1, le=90, description="Number of past days to include"),
):
    """Return all vitals entries from the last N days — used by BayMax agent and charts."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cursor = (
        col.vitals()
        .find({"user_id": user_id, "timestamp": {"$gte": cutoff}})
        .sort("timestamp", 1)
    )
    entries = []
    async for doc in cursor:
        entries.append(_doc_to_response(doc))

    return VitalsTrendResponse(user_id=user_id, days=days, count=len(entries), entries=entries)
