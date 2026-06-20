"""Pydantic schemas for BayMax agent activity logs and chat messages."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class AgentLogResponse(BaseModel):
    """A single entry in the BayMax agent activity log."""
    id: Optional[str] = None
    user_id: str
    timestamp: datetime
    action: str = Field(..., description="Short label for the action taken")
    reasoning: Optional[str] = Field(None, description="Agent's chain-of-thought reasoning")
    severity: Literal["info", "warning", "critical"] = "info"
    tool_used: Optional[str] = None
    result: Optional[str] = None

    class Config:
        from_attributes = True


class AgentLogListResponse(BaseModel):
    user_id: str
    total: int
    logs: List[AgentLogResponse]


# ─── Chat Schemas ──────────────────────────────────────────────────────────────

class ChatMessageRequest(BaseModel):
    """User message sent to BayMax interactive chat."""
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: Optional[str] = Field(
        None,
        description="Optional session ID to continue an existing conversation",
    )


class ChatMessageResponse(BaseModel):
    """BayMax chat reply."""
    session_id: str
    user_message: str
    baymax_response: str
    timestamp: datetime
    tool_calls_made: Optional[List[str]] = None
