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
plain language the patient can understand.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRACKER SUGGESTION PROTOCOL (read carefully):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Whenever the user describes a health inconvenience, symptom, habit concern,
or lifestyle difficulty that could benefit from regular self-monitoring,
you MUST append the following structured block at the very end of your
Final Answer — after your normal response text, on its own line:

<!--SUGGEST_TRACKERS:[{{"name":"Example Tracker","unit":"done","frequency":"daily","time":"08:00","reason":"Why this helps","icon":"🌿"}}]-->

Strict rules for the block:
  • Include 2 to 4 tracker objects. Quality over quantity.
  • "name"      — short, specific, actionable (e.g. "Oil Hair", NOT "Hair Care")
  • "unit"      — e.g. hours, mg, kg, ml, steps, 1-10, done, strands, minutes
  • "frequency" — MUST be exactly one of: daily | every_3_days | weekly
  • "time"      — HH:MM in 24-hour format (best time for the user to log it)
  • "reason"    — one sentence explaining WHY this tracker is helpful
  • "icon"      — a single relevant emoji representing the tracker
  • The block must be syntactically valid JSON — use double quotes only.
  • Do NOT include this block for general questions, data lookups, or small talk.
  • Only fire this when the user is clearly describing something they struggle with.

Examples of when to suggest trackers:
  "I am facing hair loss"   → Oil Hair, Hair Fall Count, Biotin Intake, Scalp Health
  "I can't sleep"           → Hours Slept, Caffeine Intake, Sleep Quality, Bedtime
  "my knees hurt"           → Pain Level, Steps Walked, Physio Session, Anti-inflammatory Med
  "I feel stressed"         → Stress Level, Mindfulness Minutes, Screen Time, Water Intake
  "I've been gaining weight" → Body Weight, Calories Eaten, Exercise Minutes, Water Intake
  "I get headaches often"   → Headache Intensity, Water Intake, Screen Hours, Sleep Hours

Examples of when NOT to suggest trackers:
  "What is my blood pressure today?"
  "Show me my glucose trend"
  "Thanks!"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\
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
Final Answer: your friendly, clear response to the patient (include the <!--SUGGEST_TRACKERS:...--> block at the end if the user described a health concern)

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
        max_iterations=6,               # Enough for tool calls + Final Answer
        max_execution_time=60,
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

    _LIMIT_PHRASES = (
        "agent stopped due to iteration limit",
        "agent stopped due to time limit",
        "iteration limit",
        "time limit",
    )
    raw_output = result.get("output", "")
    if not raw_output or any(p in raw_output.lower() for p in _LIMIT_PHRASES):
        # The agent hit its budget without a clean Final Answer — build one from
        # whatever intermediate steps were completed instead of leaking the error.
        completed = [
            step[0].log.strip()
            for step in result.get("intermediate_steps", [])
            if step and hasattr(step[0], "log") and step[0].log.strip()
        ]
        if completed:
            response_text = (
                "I've gathered some information for you, though I ran into a "
                "processing limit before I could finish. Here's what I found so far:\n\n"
                + "\n".join(f"• {s}" for s in completed[-3:])
                + "\n\nPlease ask a more specific question and I'll answer fully."
            )
        else:
            response_text = (
                "I'm having a bit of trouble processing that right now. "
                "Could you try rephrasing your question? I'm here to help!"
            )
    else:
        response_text = raw_output
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
