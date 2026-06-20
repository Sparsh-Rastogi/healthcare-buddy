"""Pydantic schemas for patient compliance tracking."""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class ComplianceLogCreate(BaseModel):
    """Request body for logging a compliance entry."""
    measure: str = Field(
        ...,
        description="The compliance measure (e.g., 'morning_bp_reading', 'medication_taken')",
    )
    completed: bool = Field(True, description="Whether the measure was completed")
    notes: Optional[str] = Field(None, max_length=500)
    log_date: Optional[date] = Field(None, description="Defaults to today if not provided")


class ComplianceLogResponse(ComplianceLogCreate):
    """Compliance entry as stored in the database."""
    id: Optional[str] = None
    user_id: str
    date: str  # ISO date string (YYYY-MM-DD)
    logged_at: datetime

    class Config:
        from_attributes = True


class ComplianceStatusResponse(BaseModel):
    """Today's compliance summary for a user."""
    user_id: str
    date: str
    total_entries: int
    completed_count: int
    pending_measures: list[str]
    entries: list[ComplianceLogResponse]
