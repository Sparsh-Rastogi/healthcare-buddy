"""
User profile routes.
POST /api/v1/users/profile  — Create or update profile (encrypts groq_api_key)
GET  /api/v1/users/profile  — Fetch own profile (key is masked)
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import decrypt_key, encrypt_key
from app.db import collections as col
from app.middleware.auth import get_current_user
from app.models.user import UserProfileCreate, UserProfileResponse
from app.integrations.google_calendar import schedule_doctor_reminders

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["Users"])


def _sanitize(doc: dict) -> dict:
    """Remove internal MongoDB fields and encrypted key before returning.

    conditions and medications are safe to return — only the Fernet-encrypted
    groq_api_key must be masked.
    """
    doc.pop("_id", None)
    doc.pop("groq_api_key", None)
    return doc


@router.post("/profile", response_model=UserProfileResponse, status_code=status.HTTP_200_OK)
async def upsert_profile(
    body: UserProfileCreate,
    user_id: str = Depends(get_current_user),
):
    """Create or update the authenticated user's profile."""
    now = datetime.now(timezone.utc)
    update_data = body.model_dump(exclude_none=True)

    # Encrypt Groq key before writing
    if raw_key := update_data.pop("groq_api_key", None):
        update_data["groq_api_key"] = encrypt_key(raw_key)

    update_data["updated_at"] = now
    existing = await col.users().find_one({"user_id": user_id})

    if existing:
        old_instructions = existing.get("doctor_instructions", "")
        await col.users().update_one({"user_id": user_id}, {"$set": update_data})
        # Fire calendar reminders if doctor instructions changed
        if update_data.get("doctor_instructions") and update_data["doctor_instructions"] != old_instructions:
            try:
                await schedule_doctor_reminders(user_id, update_data["doctor_instructions"])
            except Exception as exc:
                logger.warning(f"[Calendar] Could not schedule reminders: {exc}")
    else:
        update_data.update({"user_id": user_id, "is_active": True, "created_at": now})
        await col.users().insert_one(update_data)
        if update_data.get("doctor_instructions"):
            try:
                await schedule_doctor_reminders(user_id, update_data["doctor_instructions"])
            except Exception as exc:
                logger.warning(f"[Calendar] Could not schedule reminders: {exc}")

    updated = await col.users().find_one({"user_id": user_id})
    return UserProfileResponse(**_sanitize(updated))


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(user_id: str = Depends(get_current_user)):
    """Fetch the authenticated user's profile."""
    profile = await col.users().find_one({"user_id": user_id})
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return UserProfileResponse(**_sanitize(profile))


@router.delete("/profile", status_code=status.HTTP_200_OK)
async def deactivate_profile(user_id: str = Depends(get_current_user)):
    """Soft-delete: mark user as inactive."""
    result = await col.users().update_one(
        {"user_id": user_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return {"detail": "Profile deactivated."}
