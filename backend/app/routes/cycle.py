"""
Cycle tracking routes.
POST /api/v1/cycle/log      — Log a new cycle entry
GET  /api/v1/cycle/history  — Fetch cycle history (newest first)
"""

import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Query, status

from app.db import collections as col
from app.middleware.auth import get_current_user
from app.models.cycle import CycleLogCreate, CycleLogResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cycle", tags=["Cycle Tracking"])


def _doc_to_response(doc: dict) -> CycleLogResponse:
    doc["id"] = str(doc.pop("_id", ""))
    return CycleLogResponse(**doc)


@router.post("/log", response_model=CycleLogResponse, status_code=status.HTTP_201_CREATED)
async def log_cycle(
    body: CycleLogCreate,
    user_id: str = Depends(get_current_user),
):
    """Log a menstrual cycle entry."""
    now = datetime.now(timezone.utc)
    doc = body.model_dump(exclude_none=True)
    # Convert date objects to ISO strings for MongoDB
    for field in ("cycle_start", "cycle_end"):
        if field in doc and doc[field]:
            doc[field] = doc[field].isoformat()
    doc.update({"user_id": user_id, "logged_at": now})
    result = await col.cycle_logs().insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return CycleLogResponse(**doc)


@router.get("/history", response_model=List[CycleLogResponse])
async def get_cycle_history(
    user_id: str = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
):
    """Fetch the authenticated user's cycle history, newest first."""
    skip = (page - 1) * page_size
    cursor = (
        col.cycle_logs()
        .find({"user_id": user_id})
        .sort("cycle_start", -1)
        .skip(skip)
        .limit(page_size)
    )
    docs = []
    async for doc in cursor:
        docs.append(_doc_to_response(doc))
    return docs
