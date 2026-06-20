"""
MongoDB-backed conversation memory for BayMax interactive chat.

Uses LangChain's MongoDBChatMessageHistory as the backing store so that
conversation context survives server restarts.  ConversationSummaryBufferMemory
compresses old messages into a running summary to stay within token limits.
"""

import logging
from langchain_community.chat_message_histories import MongoDBChatMessageHistory
from langchain.memory import ConversationSummaryBufferMemory
from langchain_groq import ChatGroq

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def get_mongo_chat_history(session_id: str) -> MongoDBChatMessageHistory:
    """
    Return a MongoDBChatMessageHistory instance for a given session.
    Messages are stored in the `chat_history` collection.
    """
    return MongoDBChatMessageHistory(
        connection_string=settings.MONGODB_URI,
        session_id=session_id,
        database_name=settings.MONGODB_DB_NAME,
        collection_name="chat_history",
    )


def get_summary_memory(session_id: str, api_key: str) -> ConversationSummaryBufferMemory:
    """
    Return a ConversationSummaryBufferMemory backed by MongoDB.

    The LLM compresses old messages into a running summary once the buffer
    exceeds max_token_limit, keeping recent messages intact for context.

    Args:
        session_id: Unique identifier for this conversation.
        api_key: Groq API key used for summary compression.
    """
    llm = ChatGroq(
        api_key=api_key,
        model=settings.GROQ_MODEL,
        temperature=0.0,
        max_tokens=512,  # Keep compression calls lightweight
    )

    history = get_mongo_chat_history(session_id)

    memory = ConversationSummaryBufferMemory(
        llm=llm,
        chat_memory=history,
        max_token_limit=1500,        # Compress when buffer exceeds ~1500 tokens
        return_messages=True,
        memory_key="chat_history",
        output_key="output",
    )
    return memory


async def clear_session(session_id: str) -> None:
    """Delete all messages for a session (e.g., when user explicitly resets chat)."""
    history = get_mongo_chat_history(session_id)
    history.clear()
    logger.info(f"[Memory] Cleared chat history for session {session_id}")
