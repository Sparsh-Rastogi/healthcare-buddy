"""
Google Drive integration — Service Account based.

All operations use a single service account whose credentials are loaded from
GOOGLE_SERVICE_ACCOUNT_JSON (a JSON string in the environment variable).

Functions:
  upload_file(file_bytes, filename, mime_type) → drive_file_id
  download_file(drive_file_id)                 → bytes
"""

import io
import json
import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_drive_service():
    """Build and return an authenticated Google Drive service client."""
    sa_json = settings.GOOGLE_SERVICE_ACCOUNT_JSON
    if not sa_json:
        raise RuntimeError(
            "GOOGLE_SERVICE_ACCOUNT_JSON is not set. "
            "Provide the service account JSON string in your .env file."
        )

    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    sa_info = json.loads(sa_json)
    credentials = service_account.Credentials.from_service_account_info(
        sa_info,
        scopes=["https://www.googleapis.com/auth/drive"],
    )
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


async def upload_file(
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    folder_id: Optional[str] = None,
) -> str:
    """
    Upload a file to Google Drive under the configured folder.

    Args:
        file_bytes : Raw file content.
        filename   : Original filename (used as Drive title).
        mime_type  : MIME type of the file.
        folder_id  : Target folder ID. Defaults to GOOGLE_DRIVE_FOLDER_ID from env.

    Returns:
        The Google Drive file ID of the uploaded file.
    """
    from googleapiclient.http import MediaIoBaseUpload
    import asyncio

    target_folder = folder_id or settings.GOOGLE_DRIVE_FOLDER_ID
    service = _get_drive_service()

    file_metadata = {"name": filename}
    if target_folder:
        file_metadata["parents"] = [target_folder]

    media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime_type, resumable=False)

    # Drive API is synchronous — run in thread pool to avoid blocking event loop
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: service.files()
        .create(body=file_metadata, media_body=media, fields="id")
        .execute(),
    )

    drive_file_id: str = response["id"]
    logger.info(f"[Drive] ✅ Uploaded '{filename}' → file_id={drive_file_id}")
    return drive_file_id


async def download_file(drive_file_id: str) -> bytes:
    """
    Download a file from Google Drive by its file ID.

    Args:
        drive_file_id: The Google Drive file ID.

    Returns:
        Raw file bytes.
    """
    import asyncio
    from googleapiclient.http import MediaIoBaseDownload

    service = _get_drive_service()
    request = service.files().get_media(fileId=drive_file_id)

    def _download() -> bytes:
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buffer.getvalue()

    loop = asyncio.get_event_loop()
    file_bytes = await loop.run_in_executor(None, _download)
    logger.info(f"[Drive] ✅ Downloaded file_id={drive_file_id} ({len(file_bytes)} bytes)")
    return file_bytes


async def delete_file(drive_file_id: str) -> None:
    """Delete a file from Google Drive by its file ID."""
    import asyncio

    service = _get_drive_service()
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: service.files().delete(fileId=drive_file_id).execute(),
    )
    logger.info(f"[Drive] 🗑️  Deleted file_id={drive_file_id}")
