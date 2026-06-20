"""
BayMax – Healthcare Buddy
Application configuration via pydantic-settings.
Includes Fernet encryption helpers for Groq API key storage.
"""

import logging
from functools import lru_cache
from typing import List

from cryptography.fernet import Fernet
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # ── App ─────────────────────────────────────────────────────────────────
    APP_NAME: str = "BayMax – Healthcare Buddy"
    ENV: str = "development"
    DEVELOPMENT_MODE: bool = False

    # ── MongoDB ──────────────────────────────────────────────────────────────
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "baymax_db"

    # ── Supabase Auth ────────────────────────────────────────────────────────
    SUPABASE_JWT_SECRET: str = ""

    # ── Groq AI ──────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ── Fernet Encryption ────────────────────────────────────────────────────
    FERNET_KEY: str = ""

    # ── Google Service Account ───────────────────────────────────────────────
    GOOGLE_SERVICE_ACCOUNT_JSON: str = ""
    GOOGLE_DRIVE_FOLDER_ID: str = ""
    GOOGLE_CALENDAR_ID: str = "primary"

    # ── SendGrid (stubbed) ───────────────────────────────────────────────────
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = "baymax@healthcare-buddy.com"

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # ── Scheduler ────────────────────────────────────────────────────────────
    AGENT_LOOP_INTERVAL_MINUTES: int = 15

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# ─── Fernet Helpers ────────────────────────────────────────────────────────────

_fernet_instance: Fernet | None = None


def _get_fernet() -> Fernet:
    """Return (or lazily initialise) the Fernet cipher."""
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    key = get_settings().FERNET_KEY
    if not key:
        # Auto-generate an ephemeral key for dev — NOT safe for production
        logger.warning(
            "[Config] ⚠️  FERNET_KEY not set — generating ephemeral key. "
            "Encrypted values will be lost on restart. Set FERNET_KEY in .env."
        )
        key = Fernet.generate_key().decode()

    _fernet_instance = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet_instance


def encrypt_key(plain_text: str) -> str:
    """Encrypt a plain-text string (e.g., Groq API key) for DB storage."""
    return _get_fernet().encrypt(plain_text.encode()).decode()


def decrypt_key(cipher_text: str) -> str:
    """Decrypt a previously encrypted string from DB storage."""
    return _get_fernet().decrypt(cipher_text.encode()).decode()
