"""
Agent activity log routes.
GET /api/v1/agent/logs  — Paginated agent activity log for the authenticated user
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, Query

from app.db import collections as col
from app.middleware.auth import get_current_user
from app.models.agent import AgentLogListResponse, AgentLogResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agent", tags=["Agent Logs"])


def _doc_to_response(doc: dict) -> AgentLogResponse:
    doc["id"] = str(doc.pop("_id", ""))
    return AgentLogResponse(**doc)


@router.get("/logs", response_model=AgentLogListResponse)
async def get_agent_logs(
    user_id: str = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    severity: str = Query(None, description="Filter by severity: info | warning | critical"),
):
    """Return paginated BayMax agent activity logs, newest first."""
    query: dict = {"user_id": user_id}
    if severity:
        query["severity"] = severity.lower()

    skip = (page - 1) * page_size
    cursor = (
        col.agent_logs()
        .find(query)
        .sort("timestamp", -1)
        .skip(skip)
        .limit(page_size)
    )
    docs = []
    async for doc in cursor:
        docs.append(_doc_to_response(doc))

    total = await col.agent_logs().count_documents(query)
    return AgentLogListResponse(user_id=user_id, total=total, logs=docs)
