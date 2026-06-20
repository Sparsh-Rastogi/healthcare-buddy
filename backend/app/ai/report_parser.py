"""
BayMax Report Parser — PyMuPDF + Tesseract OCR + Groq LLM Extractor.

Pipeline:
  1. Download file from Google Drive by drive_file_id
  2. PDF  → PyMuPDF text extraction
     Image → Pytesseract OCR
  3. Strip whitespace & noise (token optimisation for free-tier Groq)
  4. Send cleaned text to Groq LLM with a structured extraction prompt
  5. Parse JSON response into vitals fields
  6. Save extracted vitals to MongoDB and mark report as parsed
"""

import json
import logging
import re
import tempfile
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.config import get_settings, decrypt_key
from app.db import collections as col
from app.integrations.google_drive import download_file

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── Token Optimisation Helpers ────────────────────────────────────────────────

def _clean_text(raw: str, max_chars: int = 8000) -> str:
    """
    Strip OCR noise and whitespace from extracted text before sending to LLM.
    Trims to max_chars to protect free-tier token quota.
    """
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", raw)
    # Remove form-feed characters (common in PDFs)
    text = text.replace("\x0c", "\n")
    # Collapse multiple spaces
    text = re.sub(r" {2,}", " ", text)
    # Strip leading/trailing whitespace per line
    text = "\n".join(line.strip() for line in text.splitlines())
    # Remove lines that are purely symbols/noise (no alphanumeric chars)
    text = "\n".join(line for line in text.splitlines() if re.search(r"[a-zA-Z0-9]", line))
    return text[:max_chars].strip()


# ─── Text Extraction ────────────────────────────────────────────────────────

def _extract_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF using PyMuPDF."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = [page.get_text() for page in doc]
        doc.close()
        return "\n".join(pages)
    except Exception as exc:
        logger.error(f"[ReportParser] PyMuPDF extraction failed: {exc}")
        return ""


def _extract_from_image(file_bytes: bytes, mime_type: str) -> str:
    """Extract text from an image using Pytesseract OCR."""
    try:
        import pytesseract
        from PIL import Image
        import io
        image = Image.open(io.BytesIO(file_bytes))
        return pytesseract.image_to_string(image)
    except Exception as exc:
        logger.error(f"[ReportParser] Pytesseract OCR failed: {exc}")
        return ""


def _extract_text(file_bytes: bytes, mime_type: str) -> str:
    """Route extraction based on mime type."""
    if mime_type == "application/pdf":
        text = _extract_from_pdf(file_bytes)
        # If PDF is scanned (very little text), fall back to OCR
        if len(text.strip()) < 100:
            logger.info("[ReportParser] PDF appears scanned — falling back to OCR")
            text = _extract_from_image(file_bytes, mime_type)
        return text
    else:
        return _extract_from_image(file_bytes, mime_type)


# ─── LLM Structured Extractor ──────────────────────────────────────────────

async def _extract_vitals_with_llm(raw_text: str, api_key: str) -> Dict[str, Any]:
    """
    Send cleaned OCR text to Groq LLM and extract structured vitals.
    Returns a dict matching the VitalsLog schema (None for missing fields).
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage

    cleaned = _clean_text(raw_text)
    if not cleaned:
        return {}

    extraction_prompt = f"""You are a medical data extraction assistant.
Extract health metrics from the following medical report text.

Return ONLY a valid JSON object with these exact keys (use null for missing values):
{{
  "systolic_bp": <number or null>,
  "diastolic_bp": <number or null>,
  "heart_rate": <number or null>,
  "blood_glucose": <number or null>,
  "weight": <number or null>,
  "temperature": <number or null>,
  "spo2": <number or null>,
  "notes": "<brief summary of key findings or null>"
}}

Do not include any explanation. Return only the JSON object.

Medical Report Text:
---
{cleaned}
---"""

    llm = ChatGroq(
        api_key=api_key,
        model=settings.GROQ_MODEL,
        temperature=0.0,
        max_tokens=400,
    )
    messages = [
        SystemMessage(content="You extract structured medical data from reports. Return only valid JSON."),
        HumanMessage(content=extraction_prompt),
    ]

    try:
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        # Strip markdown code blocks if present
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
        extracted = json.loads(content)
        logger.info(f"[ReportParser] LLM extracted: {extracted}")
        return extracted
    except (json.JSONDecodeError, Exception) as exc:
        logger.error(f"[ReportParser] LLM extraction failed: {exc}")
        return {}


# ─── Main Parse Background Task ────────────────────────────────────────────

async def parse_report_background(
    report_id: str,
    user_id: str,
    drive_file_id: str,
    mime_type: str,
) -> None:
    """
    Background task: download, OCR, extract, and persist a medical report.
    Called as asyncio.create_task() from the reports route — runs after response.
    """
    logger.info(f"[ReportParser] Starting parse: report_id={report_id} user={user_id}")

    # Resolve API key
    from app.ai.agent import _resolve_api_key
    api_key = await _resolve_api_key(user_id)
    if not api_key:
        logger.error(f"[ReportParser] No API key for {user_id} — cannot extract.")
        await col.reports().update_one(
            {"_id": __import__("bson").ObjectId(report_id)},
            {"$set": {"parse_error": "No API key available.", "parsed": False}},
        )
        return

    # Step 1: Download from Drive
    try:
        file_bytes = await download_file(drive_file_id)
    except Exception as exc:
        logger.error(f"[ReportParser] Drive download failed: {exc}")
        await col.reports().update_one(
            {"_id": __import__("bson").ObjectId(report_id)},
            {"$set": {"parse_error": f"Drive download failed: {exc}", "parsed": False}},
        )
        return

    # Step 2: Extract text (PDF or image)
    raw_text = _extract_text(file_bytes, mime_type)
    if not raw_text.strip():
        await col.reports().update_one(
            {"_id": __import__("bson").ObjectId(report_id)},
            {"$set": {"parse_error": "No text could be extracted.", "parsed": False}},
        )
        return

    # Step 3: LLM structured extraction
    extracted = await _extract_vitals_with_llm(raw_text, api_key)

    # Step 4: Save extracted vitals as a vitals entry
    if any(v is not None for k, v in extracted.items() if k != "notes"):
        now = datetime.now(timezone.utc)
        vitals_doc = {**extracted, "user_id": user_id, "timestamp": now, "source": f"report:{report_id}"}
        await col.vitals().insert_one(vitals_doc)
        logger.info(f"[ReportParser] Vitals saved from report {report_id}")

    # Step 5: Mark report as parsed
    await col.reports().update_one(
        {"_id": __import__("bson").ObjectId(report_id)},
        {"$set": {"parsed": True, "extracted_vitals": extracted, "parse_error": None}},
    )
    logger.info(f"[ReportParser] ✅ Report {report_id} parsed successfully.")
