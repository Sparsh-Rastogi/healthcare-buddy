"""
BayMax Interactive Chat Handler.

Uses the same tool set as the autonomous agent but in a conversational mode.
Conversation history is persisted via MongoDB-backed memory so users never
lose context between sessions.
"""

import logging
from typing import List, Tuple

from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from langchain_groq import ChatGroq

from app.ai.agent import AGENT_TOOLS, _resolve_api_key
from app.ai.memory import get_summary_memory
from app.config import get_settings
from app.db import collections as col

logger = logging.getLogger(__name__)
settings = get_settings()

_CHAT_PERSONA = """\
You are BayMax, a personal health companion on the Healthcare Buddy platform.
You have access to the patient's health data via tools.

You can:
  ✔  Answer questions about the patient's vitals, compliance, and cycle data
  ✔  Retrieve and explain health trends in plain language
  ✔  Proactively flag concerning patterns in data you retrieve
  ✔  Provide general health education and context (non-prescriptive)

You cannot:
  ✘  Diagnose conditions
  ✘  Prescribe medications or treatments
  ✘  Give personalised medical advice

Keep your tone warm, empathetic, and clear. Translate clinical data into \
plain language the patient can understand.\
"""

CHAT_PROMPT = PromptTemplate.from_template(
    _CHAT_PERSONA
    + """

You have access to the following tools:

{tools}

Use this format:

Question: the user's message
Thought: think about what information you need and what tools to use
Action: the action to take, one of [{tool_names}]
Action Input: a JSON string with the tool's parameters
Observation: the result of the action
... (may repeat up to 3 times)
Thought: I have enough information to respond helpfully
Final Answer: your friendly, clear response to the patient

Begin!

Previous conversation summary:
{chat_history}

Question: {input}
Thought:{agent_scratchpad}"""
)


async def handle_chat_message(
    user_id: str,
    session_id: str,
    user_message: str,
) -> Tuple[str, List[str]]:
    """
    Process a user chat message through the BayMax conversational agent.

    Args:
        user_id     : The authenticated patient's ID.
        session_id  : Unique conversation session identifier.
        user_message: The user's raw input text.

    Returns:
        Tuple of (response_text, list_of_tool_names_used)
    """
    api_key = await _resolve_api_key(user_id)
    if not api_key:
        return (
            "I'm sorry — I can't access the AI service right now. "
            "Please ensure your Groq API key is configured in your profile.",
            [],
        )

    llm = ChatGroq(
        api_key=api_key,
        model=settings.GROQ_MODEL,
        temperature=0.3,
        max_tokens=1024,
    )

    # Load MongoDB-backed summary memory
    memory = get_summary_memory(session_id=session_id, api_key=api_key)

    agent = create_react_agent(llm=llm, tools=AGENT_TOOLS, prompt=CHAT_PROMPT)
    executor = AgentExecutor(
        agent=agent,
        tools=AGENT_TOOLS,
        memory=memory,
        max_iterations=3,               # Slightly lower cap for interactive chat
        max_execution_time=45,
        verbose=False,
        handle_parsing_errors=True,
        return_intermediate_steps=True,
    )

    try:
        result = await executor.ainvoke({"input": user_message})
    except Exception as exc:
        logger.error(f"[Chat] Agent error for session {session_id}: {exc}", exc_info=True)
        return (
            "I encountered an issue processing your request. Please try again in a moment.",
            [],
        )

    response_text = result.get("output", "I'm not sure how to respond to that.")
    tools_used: List[str] = []
    for step in result.get("intermediate_steps", []):
        if step and len(step) >= 1:
            action = step[0]
            if hasattr(action, "tool"):
                tools_used.append(action.tool)

    # Persist the raw messages to chat_history collection for the history endpoint
    now_utc = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    await col.chat_history().insert_many([
        {"user_id": user_id, "session_id": session_id, "role": "user", "content": user_message, "timestamp": now_utc},
        {"user_id": user_id, "session_id": session_id, "role": "assistant", "content": response_text, "timestamp": now_utc, "tools_used": tools_used},
    ])

    logger.info(f"[Chat] session={session_id} user={user_id} tools={tools_used}")
    return response_text, tools_used
