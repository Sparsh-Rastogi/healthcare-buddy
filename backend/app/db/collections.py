"""
Typed collection accessors.
Import and call these anywhere in the app to get a typed Motor collection.
"""

from motor.motor_asyncio import AsyncIOMotorCollection
from app.db.connection import get_database


def users() -> AsyncIOMotorCollection:
    """User profiles and encrypted API keys."""
    return get_database()["users"]


def vitals() -> AsyncIOMotorCollection:
    """Patient vitals logs (BP, glucose, HR, weight, etc.)."""
    return get_database()["vitals"]


def cycle_logs() -> AsyncIOMotorCollection:
    """Menstrual cycle tracking records."""
    return get_database()["cycle_logs"]


def reports() -> AsyncIOMotorCollection:
    """Medical report metadata (Drive IDs, OCR parse status)."""
    return get_database()["reports"]


def compliance_logs() -> AsyncIOMotorCollection:
    """Daily compliance task completion records."""
    return get_database()["compliance_logs"]


def agent_logs() -> AsyncIOMotorCollection:
    """BayMax autonomous agent activity and reasoning logs."""
    return get_database()["agent_logs"]


def chat_history() -> AsyncIOMotorCollection:
    """Raw chat message history per user session."""
    return get_database()["chat_history"]


def conversation_summary() -> AsyncIOMotorCollection:
    """Compressed conversation summaries (LangChain memory backing store)."""
    return get_database()["conversation_summary"]
