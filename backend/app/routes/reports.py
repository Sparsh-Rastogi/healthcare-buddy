"""
Medical reports routes.
POST /api/v1/reports/upload  — Upload file → Google Drive → trigger OCR parse
GET  /api/v1/reports/list    — List all reports for the authenticated user
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.db import collections as col
from app.integrations.google_drive import upload_file
from app.middleware.auth import get_current_user
from app.models.reports import ReportListResponse, ReportResponse
from app.ai.report_parser import parse_report_background

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["Medical Reports"])

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
}


def _doc_to_response(doc: dict) -> ReportResponse:
    doc["id"] = str(doc.pop("_id", ""))
    return ReportResponse(**doc)


@router.post("/upload", response_model=ReportResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_report(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    """
    Upload a medical report PDF or image.
    1. Validates file type.
    2. Uploads to Google Drive.
    3. Creates a report record in MongoDB (parsed=False).
    4. Kicks off background OCR parsing.
    """
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: PDF, JPEG, PNG, TIFF, WEBP.",
        )

    contents = await file.read()
    now = datetime.now(timezone.utc)

    # Upload to Google Drive
    try:
        drive_file_id = await upload_file(
            file_bytes=contents,
            filename=file.filename,
            mime_type=file.content_type,
        )
    except Exception as exc:
        logger.error(f"[Reports] Drive upload failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Drive upload failed: {exc}",
        )

    # Save report metadata
    doc = {
        "user_id": user_id,
        "drive_file_id": drive_file_id,
        "filename": file.filename,
        "mime_type": file.content_type,
        "uploaded_at": now,
        "parsed": False,
        "extracted_vitals": None,
        "parse_error": None,
    }
    result = await col.reports().insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)

    # Kick off background OCR parse (fire-and-forget)
    import asyncio
    asyncio.create_task(
        parse_report_background(
            report_id=doc["id"],
            user_id=user_id,
            drive_file_id=drive_file_id,
            mime_type=file.content_type,
        )
    )

    return ReportResponse(**doc)


@router.get("/list", response_model=ReportListResponse)
async def list_reports(user_id: str = Depends(get_current_user)):
    """Return all medical reports for the authenticated user, newest first."""
    cursor = col.reports().find({"user_id": user_id}).sort("uploaded_at", -1)
    docs = []
    async for doc in cursor:
        docs.append(_doc_to_response(doc))
    return ReportListResponse(user_id=user_id, total=len(docs), reports=docs)
