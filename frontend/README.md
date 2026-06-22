# 🤖 BayMax – Healthcare Buddy · Frontend

React 19 + TanStack Start (Vite) frontend for the BayMax autonomous health monitoring platform. Built with Supabase Auth, a full shadcn/ui component library, Recharts visualizations, and a type-safe API client for the FastAPI backend.

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Setup & Installation](#setup--installation)
- [Routes & Pages](#routes--pages)
- [Component Architecture](#component-architecture)
- [State & Data Flow](#state--data-flow)
- [API Client](#api-client)
- [Authentication Flow](#authentication-flow)
- [Local Storage Schema](#local-storage-schema)
- [Type Definitions](#type-definitions)

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build Tool | Vite 7 + TanStack Start |
| Router | TanStack Router v1 (file-based) |
| Data Fetching | TanStack Query v5 |
| Auth | Supabase Auth (`@supabase/supabase-js`) |
| UI Components | shadcn/ui (Radix UI primitives) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts v3 |
| Forms | React Hook Form + Zod |
| Chat Rendering | `react-markdown` |
| Date Utilities | `date-fns` |
| Icons | `lucide-react` |
| Notifications | `sonner` (toast) |
| Package Manager | Bun |
| Language | TypeScript 5 |

---

## 📁 Project Structure

```
frontend/
├── src/
│   ├── routes/                    # File-based routes (TanStack Router)
│   │   ├── __root.tsx             # Root layout (AuthContext provider, global nav)
│   │   ├── index.tsx              # Dashboard — vitals overview, activity feed, quick log
│   │   ├── login.tsx              # Supabase Auth sign-in / sign-up page
│   │   ├── onboarding.tsx         # Multi-step new-user setup wizard
│   │   ├── period.tsx             # Menstrual cycle tracker
│   │   ├── reports.tsx            # Medical report upload & list
│   │   ├── trends.tsx             # Vitals trend charts (Recharts)
│   │   ├── history.tsx            # Full vitals history log
│   │   ├── visit-summary.tsx      # AI-generated clinical summary viewer
│   │   └── settings.tsx           # Profile, Groq API key, emergency contact settings
│   ├── components/
│   │   ├── chat/                  # BayMax interactive chat panel
│   │   ├── layout/                # Sidebar, top nav, mobile bottom bar
│   │   ├── ui/                    # shadcn/ui base components (button, card, dialog, …)
│   │   └── ui-x/                  # Custom extended components built on ui/
│   ├── contexts/
│   │   └── AuthContext.tsx        # Supabase session management & auth helpers
│   ├── hooks/
│   │   └── use-mobile.tsx         # Responsive breakpoint hook
│   ├── lib/
│   │   ├── api/                   # (extended) API sub-modules
│   │   ├── baymax-api.ts          # Typed REST API client for the FastAPI backend
│   │   ├── supabase.ts            # Supabase client initialisation
│   │   ├── storage.ts             # localStorage helpers with typed keys
│   │   ├── types.ts               # Shared TypeScript interfaces
│   │   ├── groq.ts                # Direct Groq SDK usage (client-side AI features)
│   │   ├── suggestedLogs.ts       # Suggested health logging prompts
│   │   ├── brand.ts               # App name, colors, and brand constants
│   │   └── utils.ts               # `cn()` classname utility
│   ├── router.tsx                 # TanStack Router instance creation
│   ├── routeTree.gen.ts           # Auto-generated route tree (do not edit manually)
│   ├── server.ts                  # SSR server entry (TanStack Start)
│   ├── start.ts                   # Client entry point
│   └── styles.css                 # Global CSS, Tailwind base/utilities
├── components.json                # shadcn/ui CLI configuration
├── vite.config.ts
├── tsconfig.json
├── bunfig.toml
├── .env.example
└── .env.local                     # (git-ignored) — your actual secrets
```

---

## 🔐 Environment Variables

Copy `.env.example` to `.env.local` for local development.

```env
# Base URL of the FastAPI backend (no trailing slash)
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Supabase Auth credentials (Dashboard → Settings → API)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> All `VITE_` prefixed variables are embedded at build time and exposed to the browser bundle. **Never store secrets here.**

---

## 🚀 Setup & Installation

### Prerequisites

- [Bun](https://bun.sh) v1.1+ (preferred) **or** Node.js 20+
- A running instance of the BayMax backend (see `backend/README.md`)
- A Supabase project with Email/Password auth enabled

### Steps

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies (using Bun)
bun install

# 3. Copy and configure environment variables
cp .env.example .env.local
# Edit .env.local with your backend URL and Supabase credentials

# 4. Start the development server
bun run dev
```

The app will be available at `http://localhost:5173` (Vite default).

### Other Commands

```bash
# Lint
bun run lint

# Format with Prettier
bun run format

# Production build
bun run build

# Preview production build
bun run preview
```

---

## 🗺 Routes & Pages

| Route | File | Description |
|---|---|---|
| `/login` | `routes/login.tsx` | Supabase sign-in / sign-up. Redirects to `/onboarding` (new users) or `/` (returning users) |
| `/onboarding` | `routes/onboarding.tsx` | Multi-step setup: name/age/gender → conditions → medications → metrics → emergency contact |
| `/` | `routes/index.tsx` | Main dashboard: today's vitals quick-log, activity feed, compliance status, BayMax chat |
| `/trends` | `routes/trends.tsx` | Recharts line/bar charts of vitals over configurable date ranges |
| `/history` | `routes/history.tsx` | Full paginated vitals log |
| `/period` | `routes/period.tsx` | Menstrual cycle tracking calendar and entry form |
| `/reports` | `routes/reports.tsx` | Upload medical reports (PDF/image) and view parsing status |
| `/visit-summary` | `routes/visit-summary.tsx` | AI-generated clinical summary — generate on-demand or view latest |
| `/settings` | `routes/settings.tsx` | Edit profile, personal Groq API key, emergency contact, doctor instructions |

---

## 🧩 Component Architecture

```
__root.tsx (Root Layout)
│
├─ AuthContext.Provider           ← Supabase session, login/logout helpers
│
├─ layout/Sidebar                 ← Desktop navigation sidebar
├─ layout/TopNav                  ← Mobile top bar
├─ layout/BottomNav               ← Mobile bottom navigation
│
└─ <Outlet />                     ← Page content renders here
     │
     ├─ index.tsx (Dashboard)
     │    ├─ VitalsQuickLog       ← Inline vitals form
     │    ├─ ComplianceWidget     ← Today's task checklist
     │    ├─ ActivityFeed         ← Agent log entries (info/warning/critical)
     │    └─ chat/ChatPanel       ← BayMax interactive chat (session-based)
     │
     ├─ trends.tsx
     │    └─ Recharts LineChart / BarChart (vitals over time)
     │
     ├─ reports.tsx
     │    ├─ FileUploadDropzone
     │    └─ ReportCard (parsed status, extracted vitals)
     │
     └─ settings.tsx
          ├─ ProfileForm          ← React Hook Form + Zod
          ├─ GroqKeyForm          ← Groq API key input (stored encrypted on backend)
          └─ EmergencyContactForm
```

---

## 🔄 State & Data Flow

### Auth State

```
Supabase SDK
  │
  └─ onAuthStateChange listener (AuthContext.tsx)
       │
       ├─ Sets session + user in React state
       ├─ Persists auth token to localStorage (KEYS.authToken)
       └─ On sign-in: calls syncProfileToBackend() to upsert user profile
```

### API Data (TanStack Query)

Server state from the FastAPI backend is managed via **TanStack Query** (`@tanstack/react-query`). The typed API client (`lib/baymax-api.ts`) is used inside query/mutation functions:

```tsx
// Example: fetching vitals trend
const { data } = useQuery({
  queryKey: ['vitals', 'trend', days],
  queryFn: () => vitalsApi.trend(days),
})

// Example: logging vitals
const mutation = useMutation({
  mutationFn: (payload: VitalsPayload) => vitalsApi.log(payload),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vitals'] }),
})
```

### Local State (localStorage)

Onboarding data and user preferences that don't need to round-trip to the backend are stored in `localStorage` using typed helpers from `lib/storage.ts`. The `syncProfileToBackend()` function merges local state into the backend when auth state changes or settings are saved.

---

## 🌐 API Client

`lib/baymax-api.ts` provides a typed, centralized HTTP client for the FastAPI backend.

**Base URL:** `VITE_API_BASE_URL` env var (defaults to `/api/v1`)

**Auth:** Every request automatically includes `Authorization: Bearer <token>` using the token stored in localStorage. No manual header configuration is needed at call sites.

### Available API Modules

```typescript
// Vitals
vitalsApi.log(payload)                    // POST /vitals/log
vitalsApi.history(page?, pageSize?)       // GET  /vitals/history
vitalsApi.trend(days?)                    // GET  /vitals/trend?days=N

// Compliance
complianceApi.log(payload)               // POST /compliance/log
complianceApi.status()                   // GET  /compliance/status

// Cycle Tracking
cycleApi.log(payload)                    // POST /cycle/log
cycleApi.history()                       // GET  /cycle/history

// Medical Reports
reportsApi.list()                        // GET  /reports/list
reportsApi.upload(file)                  // POST /reports/upload (multipart)

// Agent Logs
agentApi.logs(page?, pageSize?)          // GET  /agent/logs

// Doctor Summary
summaryApi.generate()                    // POST /summary/generate
summaryApi.latest()                      // GET  /summary/latest

// User Profile
userApi.upsertProfile(payload)           // POST /users/profile
userApi.getProfile()                     // GET  /users/profile

// Interactive Chat
chatApi.message(payload)                 // POST /chat/message
chatApi.history(sessionId)              // GET  /chat/history?session_id=...
```

**Error handling:** Any non-2xx response throws a `BaymaxApiError` (extends `Error`) with a `.status` (HTTP code) and `.message` (backend's `detail` string). Catch these in your mutation `onError` handlers.

### Backend Connectivity Check

```typescript
import { isBackendReachable } from '@/lib/baymax-api'

const online = await isBackendReachable()
// Hits GET /health on the backend root
```

---

## 🔐 Authentication Flow

```
User visits app
  │
  ├─ AuthContext mounts
  │   └─ supabase.auth.getSession() → checks existing session
  │
  ├─ No session → redirect to /login
  │
  └─ /login page
       ├─ Sign In: supabase.auth.signInWithPassword()
       ├─ Sign Up: supabase.auth.signUp()
       └─ On success:
            ├─ AuthContext receives session via onAuthStateChange
            ├─ JWT stored to localStorage (KEYS.authToken)
            ├─ syncProfileToBackend() → POST /api/v1/users/profile
            └─ Router redirects:
                 ├─ New user (no onboarding data) → /onboarding
                 └─ Returning user → /
```

**Token refresh** is handled automatically by the Supabase SDK. `AuthContext` re-subscribes to `onAuthStateChange` and updates the stored token whenever a new session is issued.

---

## 💾 Local Storage Schema

Typed keys are defined in `lib/storage.ts`. All values are JSON-serialized.

| Key (KEYS.*) | Type | Description |
|---|---|---|
| `authToken` | `string` | Supabase JWT access token |
| `authUser` | `{ id: string; email: string }` | Authenticated user's ID and email |
| `profile` | `Profile` | Patient name, age, gender, city |
| `conditions` | `Condition[]` | Health conditions selected during onboarding |
| `medications` | `Medication[]` | Medication schedule |
| `metrics` | `LogMetric[]` | Health metrics to track (BP, glucose, etc.) |
| `logEntries` | `LogEntry[]` | Local vitals log entries (pending sync) |
| `periodEntries` | `PeriodEntry[]` | Local period tracking entries |
| `emergency` | `{ name, phone, relationship }` | Emergency contact details |
| `groqKey` | `string` | User's personal Groq API key (plain text locally; encrypted on backend) |
| `doctorInstructions` | `string` | Doctor's notes / clinical rules |
| `onboardingComplete` | `boolean` | Whether the onboarding wizard has been finished |

---

## 📐 Type Definitions

Core types are defined in `lib/types.ts`:

```typescript
interface Profile {
  name: string;
  age: number | "";
  gender: "male" | "female" | "na";
  city: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string;          // HH:MM
}

interface LogMetric {
  id: string;
  name: string;
  unit: string;
  frequency: "daily" | "weekly" | "custom";
  time: string;
  source: "suggested" | "custom";
}

interface LogEntry {
  id: string;
  metricId: string;
  date: string;          // YYYY-MM-DD
  timestamp: number;
  value: string;
  note?: string;
}

interface PeriodEntry {
  id: string;
  startDate: string;     // YYYY-MM-DD
  endDate?: string;
  intensity: "light" | "medium" | "heavy";
  symptoms: string[];
}

interface ActivityItem {
  id: string;
  date: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
```

API-specific payload types are defined in `lib/baymax-api.ts` (`VitalsPayload`, `CompliancePayload`, `CyclePayload`, `UserProfilePayload`, `ReportRecord`, `AgentLogRecord`).
