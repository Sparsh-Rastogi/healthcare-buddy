"""
BayMax – Healthcare Buddy
FastAPI application entry point.

Startup sequence:
  1. Connect to MongoDB
  2. Register all API routers under /api/v1/
  3. Start APScheduler background monitoring loop
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db.connection import close_db, connect_db
from app.routes import agent, chat, compliance, cycle, reports, summary, user, vitals
from app.scheduler.agent_loop import start_scheduler, stop_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Lifespan (startup / shutdown) ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 BayMax backend starting up…")
    await connect_db()
    start_scheduler()
    yield
    logger.info("🛑 BayMax backend shutting down…")
    stop_scheduler()
    await close_db()


# ─── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="BayMax – Healthcare Buddy API",
    description=(
        "Autonomous health monitoring backend powering BayMax. "
        "Includes AI-driven vitals analysis, OCR report parsing, "
        "Google Drive/Calendar integration, and SendGrid alerts."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routers ──────────────────────────────────────────────────────────────
PREFIX = "/api/v1"
app.include_router(user.router, prefix=PREFIX)
app.include_router(vitals.router, prefix=PREFIX)
app.include_router(cycle.router, prefix=PREFIX)
app.include_router(compliance.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(agent.router, prefix=PREFIX)
app.include_router(chat.router, prefix=PREFIX)
app.include_router(summary.router, prefix=PREFIX)


# ─── Utility Routes ───────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """Liveness probe — returns 200 if the service is running."""
    return {"status": "ok", "service": "BayMax – Healthcare Buddy", "version": "1.0.0"}


@app.post("/admin/run-agent", tags=["Admin"])
async def admin_run_agent(request: Request, user_id: str):
    """
    Force-trigger a single BayMax monitoring cycle for a specific user.

    ⚠️  Protected by ENV flag:
      - ENV=development → runs freely (local testing)
      - ENV=production  → returns 403
    """
    if settings.ENV == "production":
        return JSONResponse(
            status_code=403,
            content={"detail": "Admin route is disabled in production."},
        )

    from app.ai.agent import run_agent
    from app.db import collections as col

    profile = await col.users().find_one({"user_id": user_id})
    if not profile:
        return JSONResponse(status_code=404, content={"detail": f"User '{user_id}' not found."})

    context = {
        "doctor_instructions": profile.get("doctor_instructions", ""),
        "last_summary": profile.get("last_agent_summary", ""),
    }
    result = await run_agent(user_id=user_id, context=context)
    return {"user_id": user_id, "result": result}


# ─── Global Exception Handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again."},
    )
