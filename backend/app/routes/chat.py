"""
Interactive chat routes.
POST /api/v1/chat/message — Send a message to BayMax; returns AI response.
GET  /api/v1/chat/history — Fetch conversation history for a session.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.middleware.auth import get_current_user
from app.models.agent import ChatMessageRequest, ChatMessageResponse
from app.ai.chat import handle_chat_message

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Interactive Chat"])


@router.post("/message", response_model=ChatMessageResponse)
async def chat_message(
    body: ChatMessageRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Send a message to BayMax.
    BayMax will respond with health insights, using tools if needed.
    Conversation history is persisted in MongoDB for session continuity.
    """
    session_id = body.session_id or str(uuid.uuid4())

    try:
        response_text, tools_used = await handle_chat_message(
            user_id=user_id,
            session_id=session_id,
            user_message=body.message,
        )
    except Exception as exc:
        logger.error(f"[Chat] Error for user {user_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BayMax encountered an error: {str(exc)}",
        )

    return ChatMessageResponse(
        session_id=session_id,
        user_message=body.message,
        baymax_response=response_text,
        timestamp=datetime.now(timezone.utc),
        tool_calls_made=tools_used,
    )


@router.get("/history")
async def get_chat_history(
    user_id: str = Depends(get_current_user),
    session_id: str = Query(..., description="The session ID to retrieve history for"),
):
    """Return the full message history for a given session."""
    from app.db import collections as col
    cursor = (
        col.chat_history()
        .find({"user_id": user_id, "session_id": session_id})
        .sort("timestamp", 1)
    )
    messages = []
    async for doc in cursor:
        doc.pop("_id", None)
        messages.append(doc)
    return {"session_id": session_id, "messages": messages}
