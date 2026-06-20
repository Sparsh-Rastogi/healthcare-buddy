"""Pydantic schemas for user profiles."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserProfileCreate(BaseModel):
    """Request body for creating or updating a user profile."""
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., description="Patient email address")
    emergency_contact: Optional[str] = Field(None, description="Emergency contact email")
    doctor_instructions: Optional[str] = Field(
        None,
        description="Free-text clinical rules from the patient's doctor (used by BayMax agent)",
    )
    # Plain-text key — will be Fernet-encrypted before DB write
    groq_api_key: Optional[str] = Field(None, description="Patient's personal Groq API key")


class UserProfileResponse(BaseModel):
    """Safe response schema — never exposes encrypted key."""
    user_id: str
    name: str
    email: str
    emergency_contact: Optional[str] = None
    doctor_instructions: Optional[str] = None
    is_active: bool = True
    last_agent_summary: Optional[str] = None
    summary_updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
