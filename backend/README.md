# 🤖 BayMax – Healthcare Buddy · Backend

FastAPI + MongoDB backend powering the BayMax autonomous health monitoring platform. Includes AI-driven vitals analysis via LangChain/Groq, OCR report parsing, Google Drive/Calendar integration, and an APScheduler-based autonomous agent loop.

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Setup & Installation](#setup--installation)
- [Docker Setup](#docker-setup)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Request Flow](#request-flow)
- [AI Agent & Scheduler](#ai-agent--scheduler)
- [Authentication](#authentication)
- [External Integrations](#external-integrations)

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.111 |
| Server | Uvicorn (ASGI) |
| Database | MongoDB 7+ via Motor (async) |
| AI / LLM | LangChain + Groq (Llama 3.3 70B) |
| OCR | PyMuPDF + Tesseract |
| Auth | Supabase JWT (RS256/HS256) |
| Scheduler | APScheduler 3.10 |
| Encryption | Fernet (symmetric, via `cryptography`) |
| Google APIs | Drive v3, Calendar v3 |
| Email | SendGrid (stubbed) |
| Testing | pytest + pytest-asyncio |

---

## 📁 Project Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app entry point, lifespan, CORS, router registration
│   ├── config.py                # Pydantic-settings config, Fernet encryption helpers
│   ├── ai/
│   │   ├── agent.py             # LangChain agent with tools (vitals, compliance, alerts)
│   │   ├── alert.py             # Alert evaluation and SendGrid notification logic
│   │   ├── chat.py              # Interactive chat session handler (with memory)
│   │   ├── memory.py            # MongoDB-backed conversation memory
│   │   └── report_parser.py     # OCR pipeline (PDF/image → text → structured vitals)
│   ├── db/
│   │   ├── connection.py        # Motor async MongoDB connection manager
│   │   └── collections.py      # Typed collection accessors
│   ├── integrations/
│   │   ├── google_drive.py      # Google Drive file upload (service account)
│   │   └── google_calendar.py   # Calendar event scheduling for doctor reminders
│   ├── middleware/
│   │   └── auth.py              # Supabase JWT verification dependency
│   ├── models/                  # Pydantic request/response schemas
│   │   ├── user.py
│   │   ├── vitals.py
│   │   ├── compliance.py
│   │   ├── cycle.py
│   │   ├── agent.py
│   │   └── reports.py
│   ├── routes/                  # FastAPI route handlers
│   │   ├── user.py
│   │   ├── vitals.py
│   │   ├── compliance.py
│   │   ├── cycle.py
│   │   ├── reports.py
│   │   ├── chat.py
│   │   ├── agent.py
│   │   └── summary.py
│   └── scheduler/
│       └── agent_loop.py        # APScheduler job: runs BayMax agent for all active users
├── tests/                       # pytest test suite
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── .env                         # (git-ignored) — your actual secrets
```

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in your values.

```env
# ── App ─────────────────────────────────────────────────────────────
APP_NAME="BayMax – Healthcare Buddy"
ENV=development                      # development | production
DEVELOPMENT_MODE=true                # true → bypasses JWT signature check in Swagger

# ── MongoDB ──────────────────────────────────────────────────────────
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=baymax_db

# ── Supabase Auth ────────────────────────────────────────────────────
# Dashboard → Settings → API → JWT Secret
SUPABASE_JWT_SECRET=your-supabase-jwt-secret-here

# ── Groq AI ──────────────────────────────────────────────────────────
GROQ_API_KEY=your-groq-api-key-here       # Server-side fallback key
GROQ_MODEL=llama-3.3-70b-versatile

# ── Fernet Encryption ────────────────────────────────────────────────
# Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# ⚠️  CRITICAL: Changing this invalidates all stored user API keys.
FERNET_KEY=your-fernet-key-here

# ── Google Service Account ───────────────────────────────────────────
# Paste full service account JSON as a single-line escaped string
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
GOOGLE_DRIVE_FOLDER_ID=your-shared-drive-folder-id
GOOGLE_CALENDAR_ID=primary

# ── SendGrid ────────────────────────────────────────────────────────
SENDGRID_API_KEY=your-sendgrid-api-key      # Leave empty → alerts log to console only
SENDGRID_FROM_EMAIL=baymax@your-domain.com

# ── CORS ─────────────────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# ── Scheduler ────────────────────────────────────────────────────────
AGENT_LOOP_INTERVAL_MINUTES=15
```

---

## 🚀 Setup & Installation

### Prerequisites

- Python 3.11+
- MongoDB 7+ (local or Atlas)
- Tesseract OCR (for report parsing)
  - **macOS:** `brew install tesseract`
  - **Ubuntu/Debian:** `sudo apt install tesseract-ocr tesseract-ocr-eng`
  - **Windows:** [Download installer](https://github.com/UB-Mannheim/tesseract/wiki)

### Steps

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate         # Linux / macOS
venv\Scripts\activate            # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy and configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, Supabase secret, Groq API key, etc.

# 5. Generate a Fernet key (if you haven't already)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Paste the output into FERNET_KEY in your .env

# 6. Start the development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **Base URL:** `http://localhost:8000`
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **Health Check:** `http://localhost:8000/health`

### Running Tests

```bash
pytest tests/ -v
```

---

## 🐳 Docker Setup

```bash
# 1. Build and start all services (API + MongoDB)
docker-compose up --build

# 2. Run in detached mode
docker-compose up -d

# 3. Stop services
docker-compose down
```

The Docker image installs Tesseract OCR automatically.

---

## 🗄 Database Schema

All collections live in the `baymax_db` MongoDB database (configurable via `MONGODB_DB_NAME`).

### `users` collection

Stores patient profiles. The `groq_api_key` field is **Fernet-encrypted** before write and never returned by the API.

```json
{
  "_id": "ObjectId",
  "user_id": "string (Supabase UID)",
  "name": "string",
  "email": "string",
  "emergency_contact": "string | null",
  "doctor_instructions": "string | null",
  "groq_api_key": "string (Fernet-encrypted) | null",
  "is_active": "boolean",
  "last_agent_summary": "string | null",
  "summary_updated_at": "datetime | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### `vitals` collection

One document per vitals reading. All numeric fields are optional — patients log only what they have.

```json
{
  "_id": "ObjectId",
  "user_id": "string",
  "systolic_bp": "float | null",
  "diastolic_bp": "float | null",
  "heart_rate": "float | null",
  "blood_glucose": "float | null",
  "weight": "float | null",
  "temperature": "float | null",
  "spo2": "float (0–100) | null",
  "notes": "string | null",
  "timestamp": "datetime (UTC)"
}
```

### `compliance_logs` collection

Tracks whether a patient completed a prescribed health task on a given day. Upserted per `(user_id, date, measure)` — re-logging the same measure on the same day updates it.

```json
{
  "_id": "ObjectId",
  "user_id": "string",
  "measure": "string (e.g. 'morning_bp_reading', 'medication_taken')",
  "completed": "boolean",
  "notes": "string | null",
  "date": "string (ISO YYYY-MM-DD)",
  "logged_at": "datetime (UTC)"
}
```

### `cycle_logs` collection

Menstrual cycle tracking entries.

```json
{
  "_id": "ObjectId",
  "user_id": "string",
  "cycle_start": "string (ISO YYYY-MM-DD)",
  "cycle_end": "string (ISO YYYY-MM-DD) | null",
  "phase": "string ('menstrual' | 'follicular' | 'ovulation' | 'luteal') | null",
  "symptoms": ["string"],
  "notes": "string | null",
  "logged_at": "datetime (UTC)"
}
```

### `reports` collection

Medical report metadata. The actual file lives in Google Drive; only the `drive_file_id` is stored here.

```json
{
  "_id": "ObjectId",
  "user_id": "string",
  "drive_file_id": "string",
  "filename": "string",
  "mime_type": "string (e.g. 'application/pdf')",
  "uploaded_at": "datetime (UTC)",
  "parsed": "boolean",
  "extracted_vitals": "object | null",
  "parse_error": "string | null"
}
```

### `agent_logs` collection

BayMax autonomous agent activity log. Written by the scheduler and alert system.

```json
{
  "_id": "ObjectId",
  "user_id": "string",
  "timestamp": "datetime (UTC)",
  "action": "string",
  "reasoning": "string | null",
  "severity": "string ('info' | 'warning' | 'critical')",
  "tool_used": "string | null",
  "result": "string | null"
}
```

### `chat_history` collection

Persistent conversation memory for BayMax interactive chat sessions.

```json
{
  "_id": "ObjectId",
  "user_id": "string",
  "session_id": "string (UUID)",
  "role": "string ('user' | 'assistant')",
  "content": "string",
  "timestamp": "datetime (UTC)"
}
```

---

## 📡 API Reference

All routes are prefixed with `/api/v1`. Every route (except `/health`) requires a Supabase JWT in the `Authorization: Bearer <token>` header.

### Users

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/users/profile` | Create or update profile (Fernet-encrypts Groq key) |
| `GET` | `/api/v1/users/profile` | Fetch own profile (encrypted key is masked) |
| `DELETE` | `/api/v1/users/profile` | Soft-delete (marks `is_active: false`) |

### Vitals

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `POST` | `/api/v1/vitals/log` | — | Log a new vitals reading |
| `GET` | `/api/v1/vitals/history` | `page`, `page_size` | Paginated vitals history (newest first) |
| `GET` | `/api/v1/vitals/trend` | `days` (1–90, default 7) | All vitals in the last N days |

### Compliance

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `POST` | `/api/v1/compliance/log` | — | Log a compliance measure (upserted per day) |
| `GET` | `/api/v1/compliance/status` | — | Today's compliance summary |
| `GET` | `/api/v1/compliance/history` | `page`, `page_size` | Paginated compliance history |

### Cycle Tracking

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `POST` | `/api/v1/cycle/log` | — | Log a menstrual cycle entry |
| `GET` | `/api/v1/cycle/history` | `page`, `page_size` | Paginated cycle history (newest first) |

### Medical Reports

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/reports/upload` | Upload PDF/image → Google Drive → async OCR parse |
| `GET` | `/api/v1/reports/list` | List all reports for the user (newest first) |

Supported MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/tiff`, `image/webp`

### Interactive Chat

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `POST` | `/api/v1/chat/message` | — | Send a message to BayMax; returns AI response |
| `GET` | `/api/v1/chat/history` | `session_id` (required) | Fetch conversation history for a session |

### Agent Logs

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `GET` | `/api/v1/agent/logs` | `page`, `page_size`, `severity` | Paginated BayMax activity logs |

### Doctor Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/summary/generate` | Generate a structured clinical summary via Groq LLM |
| `GET` | `/api/v1/summary/latest` | Fetch the most recently generated summary |

### System / Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `POST` | `/admin/run-agent?user_id=...` | Force-trigger an agent cycle (dev only) |

---

## 🔄 Request Flow

### Typical Authenticated Request

```
Client
  │
  ├─ GET /api/v1/vitals/history
  │   Authorization: Bearer <supabase-jwt>
  │
  ▼
FastAPI (Uvicorn)
  │
  ├─ CORSMiddleware  ──────────── validates Origin header
  │
  ├─ Route handler: GET /api/v1/vitals/history
  │   │
  │   ├─ Depends(get_current_user)
  │   │     └─ middleware/auth.py
  │   │           ├─ Extracts Bearer token from Authorization header
  │   │           ├─ Decodes JWT using SUPABASE_JWT_SECRET
  │   │           │   (DEVELOPMENT_MODE=true → skips signature check)
  │   │           └─ Returns user_id (Supabase UID) ── or 401 if invalid
  │   │
  │   ├─ Queries MongoDB (Motor async): col.vitals().find(...)
  │   │
  │   └─ Returns JSON response (Pydantic-validated)
  │
  ▼
Client receives paginated vitals list
```

### Report Upload Flow

```
Client uploads PDF/image
  │
  ▼
POST /api/v1/reports/upload
  │
  ├─ 1. Validate JWT → get user_id
  ├─ 2. Validate MIME type (PDF, JPEG, PNG, TIFF, WEBP)
  ├─ 3. Upload raw bytes → Google Drive (service account)
  │        └─ Returns drive_file_id
  ├─ 4. Insert report record in MongoDB
  │        └─ { parsed: false, extracted_vitals: null }
  ├─ 5. Return 202 Accepted immediately
  │
  └─ Background task (asyncio.create_task):
       parse_report_background()
         ├─ Download file from Google Drive
         ├─ OCR: PyMuPDF (PDF) or Tesseract (image)
         ├─ Send extracted text to Groq LLM
         │     └─ Extract structured vitals JSON
         └─ Update MongoDB report: { parsed: true, extracted_vitals: {...} }
```

### Interactive Chat Flow

```
Client: POST /api/v1/chat/message
  │  { "message": "How is my blood pressure trending?", "session_id": "uuid" }
  │
  ▼
chat.py route
  │
  └─ handle_chat_message(user_id, session_id, user_message)
       │
       ├─ Load conversation history from MongoDB (chat_history collection)
       ├─ Fetch user profile + Groq API key (decrypt from DB if present)
       ├─ Build LangChain agent with tools:
       │     • get_vitals_trend   → queries vitals collection
       │     • get_compliance     → queries compliance_logs
       │     • get_cycle_history  → queries cycle_logs
       │     • get_agent_logs     → queries agent_logs
       ├─ Invoke agent with message + history
       ├─ Persist new messages to chat_history collection
       └─ Return { baymax_response, session_id, tool_calls_made }
```

### Autonomous Agent Loop

```
APScheduler (every AGENT_LOOP_INTERVAL_MINUTES minutes)
  │
  └─ agent_loop.py: run_for_all_users()
       │
       ├─ Fetch all { is_active: true } users from MongoDB
       │
       └─ For each user: run_agent(user_id, context)
            │
            ├─ Resolve Groq API key (user key → server fallback)
            ├─ Fetch recent vitals (last 7 days)
            ├─ Fetch today's compliance status
            ├─ Run LangChain agent with monitoring tools
            │     • analyze_vitals_trend
            │     • check_compliance
            │     • send_alert (→ SendGrid or console log)
            │     • log_agent_activity
            ├─ Write agent_logs entry to MongoDB
            └─ Update users.last_agent_summary
```

---

## 🤖 AI Agent & Scheduler

The autonomous agent (`app/ai/agent.py`) is a LangChain ReAct agent powered by Groq's `llama-3.3-70b-versatile` model. It has access to the following tools:

| Tool | Description |
|---|---|
| `analyze_vitals_trend` | Fetches the last 7 days of vitals and evaluates anomalies |
| `check_compliance` | Reads today's compliance log and lists pending tasks |
| `send_alert` | Sends an alert email via SendGrid (or logs to console) |
| `log_agent_activity` | Writes a structured entry to the `agent_logs` collection |

The agent runs on a schedule (`APScheduler`) defined by `AGENT_LOOP_INTERVAL_MINUTES` (default: every 15 minutes). It processes all active users sequentially.

**API key resolution order:**
1. User's personal Groq key stored in MongoDB (Fernet-decrypted at runtime)
2. Server-level `GROQ_API_KEY` from environment variables

---

## 🔐 Authentication

Authentication is handled via **Supabase JWT tokens** issued on the frontend after a Supabase Auth sign-in.

- Every protected route uses `Depends(get_current_user)` from `middleware/auth.py`
- The middleware decodes the Bearer token using `python-jose` with the `SUPABASE_JWT_SECRET`
- The decoded `sub` claim (Supabase user UUID) is used as `user_id` throughout
- Setting `DEVELOPMENT_MODE=true` skips JWT signature verification — useful for Swagger UI testing with mock tokens

---

## 🌐 External Integrations

### Google Drive
- Uses a **service account** (JSON provided via `GOOGLE_SERVICE_ACCOUNT_JSON` env var)
- Uploads medical reports to a shared Drive folder (`GOOGLE_DRIVE_FOLDER_ID`)
- Files are later downloaded for OCR processing

### Google Calendar
- Automatically creates Google Calendar reminders when a user's `doctor_instructions` are saved/updated
- Events are created on `GOOGLE_CALENDAR_ID` (default: `primary`)

### SendGrid
- Sends alert emails to the patient's `emergency_contact` when BayMax detects anomalies
- If `SENDGRID_API_KEY` is not set, alerts are printed to the server log only (safe for development)

### Groq (LLM)
- Used for vitals analysis, clinical summary generation, OCR-extracted data structuring, and interactive chat
- Model: `llama-3.3-70b-versatile` (configurable via `GROQ_MODEL`)
