"""Pydantic schemas for patient vitals logs."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class VitalsLog(BaseModel):
    """Request body for logging a vitals entry."""
    systolic_bp: Optional[float] = Field(None, description="Systolic blood pressure (mmHg)")
    diastolic_bp: Optional[float] = Field(None, description="Diastolic blood pressure (mmHg)")
    heart_rate: Optional[float] = Field(None, description="Heart rate (bpm)")
    blood_glucose: Optional[float] = Field(None, description="Blood glucose (mg/dL)")
    weight: Optional[float] = Field(None, description="Body weight (kg)")
    temperature: Optional[float] = Field(None, description="Body temperature (°C)")
    spo2: Optional[float] = Field(None, ge=0, le=100, description="Blood oxygen saturation (%)")
    notes: Optional[str] = Field(None, max_length=1000)


class VitalsResponse(VitalsLog):
    """Vitals entry as stored in the database."""
    id: Optional[str] = None
    user_id: str
    timestamp: datetime

    class Config:
        from_attributes = True


class VitalsTrendResponse(BaseModel):
    """Aggregated vitals trend summary for a date range."""
    user_id: str
    days: int
    count: int
    entries: list[VitalsResponse]
