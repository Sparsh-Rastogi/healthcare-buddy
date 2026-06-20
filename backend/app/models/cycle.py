"""Pydantic schemas for menstrual cycle tracking."""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class CycleLogCreate(BaseModel):
    """Request body for logging a cycle entry."""
    cycle_start: date = Field(..., description="Cycle start date")
    cycle_end: Optional[date] = Field(None, description="Cycle end date (if known)")
    phase: Optional[str] = Field(
        None,
        description="Phase: menstrual | follicular | ovulation | luteal",
    )
    symptoms: Optional[List[str]] = Field(default_factory=list, description="Reported symptoms")
    notes: Optional[str] = Field(None, max_length=1000)


class CycleLogResponse(CycleLogCreate):
    """Cycle entry as stored in the database."""
    id: Optional[str] = None
    user_id: str
    logged_at: datetime

    class Config:
        from_attributes = True
