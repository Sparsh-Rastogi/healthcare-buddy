"""
Async MongoDB connection manager using Motor.
Call connect_db() on app startup and close_db() on shutdown.
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import get_settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    """Open MongoDB connection and verify with a ping."""
    global _client
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.MONGODB_URI)
    # Verify the connection is live
    await _client.admin.command("ping")
    logger.info(f"[DB] ✅ Connected to MongoDB → {settings.MONGODB_URI} / {settings.MONGODB_DB_NAME}")


async def close_db() -> None:
    """Gracefully close the MongoDB connection."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("[DB] 🔌 MongoDB connection closed.")


def get_database() -> AsyncIOMotorDatabase:
    """Return the active database instance. Raises if not yet connected."""
    if _client is None:
        raise RuntimeError(
            "Database client is not initialised. "
            "Ensure connect_db() was called during app startup."
        )
    settings = get_settings()
    return _client[settings.MONGODB_DB_NAME]
