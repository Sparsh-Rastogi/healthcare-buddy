"""Pydantic schemas for medical reports (Drive-backed with OCR parsing)."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ReportResponse(BaseModel):
    """Medical report metadata as stored in the database."""
    id: Optional[str] = None
    user_id: str
    drive_file_id: str = Field(..., description="Google Drive file ID")
    filename: str
    mime_type: Optional[str] = None
    uploaded_at: datetime
    parsed: bool = False
    extracted_vitals: Optional[Dict[str, Any]] = Field(
        None,
        description="Structured vitals extracted by LLM after OCR parse",
    )
    parse_error: Optional[str] = None

    class Config:
        from_attributes = True


class ReportListResponse(BaseModel):
    user_id: str
    total: int
    reports: List[ReportResponse]
