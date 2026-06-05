# Healthcare Buddy — Build Plan

A calm, light-mode health companion SPA. All state in localStorage; AI features call Groq directly from the browser.

## Tech & Conventions

- TanStack Router (file-based, already scaffolded) + TanStack Query
- Tailwind v4 with semantic tokens in `src/styles.css` (off-white bg, muted greens/blues, rose for periods, amber/red reserved for warnings/critical)
- shadcn/ui primitives (Card, Button, Dialog, Sheet, Tabs, Checkbox, Input, Drawer, Sonner)
- Recharts for trends
- Groq SDK via `fetch` to `https://api.groq.com/openai/v1/chat/completions`, model default `llama3-70b-8192`
- All data in `localStorage` under namespaced keys (`hb:profile`, `hb:conditions`, `hb:meds`, `hb:logs`, `hb:logEntries`, `hb:period`, `hb:summary`, `hb:reports`, `hb:activity`, `hb:groqKey`, `hb:emergency`)
- `confirm()`-style AlertDialog for destructive actions; warm empty-state copy throughout

## Design Tokens (src/styles.css)

```text
--background: off-white (#FBFAF7-ish in oklch)
--card: pure white
--primary: muted green
--accent: muted blue
--rose: soft rose (period tracker)
--warning: muted amber
--critical: muted red (reserved)
--radius: 0.875rem (rounded), gentle shadow utility
```

## Data Models (TypeScript types in `src/lib/types.ts`)

- `Profile { name, age, gender: 'male'|'female'|'na', city }`
- `Condition { id, label, custom?: boolean }`
- `Medication { id, name, dosage, time }`
- `LogMetric { id, name, unit, frequency: 'daily'|'weekly'|'custom', time, source: 'suggested'|'custom' }`
- `LogEntry { id, metricId, date, value, note? }`
- `PeriodEntry { id, startDate, endDate?, intensity, symptoms[] }`
- `ReportFile { id, name, date, type: 'lab'|'prescription'|'other', dataUrl }`
- `ActivityItem { id, date, title, body, severity: 'info'|'warning'|'critical' }`
- `MedicalSummary { generatedAt, sections: { conditions, meds, symptoms, surgeries, family, lifestyle } }`

Storage helpers in `src/lib/storage.ts` (typed get/set + React hook `useLocalState`).

## Routes (src/routes/)

```
__root.tsx                     header + drawer + FAB + Outlet
index.tsx                      Home (gated by onboarding completion → redirect to /onboarding)
onboarding.tsx                 6-step wizard (internal step state)
reports.tsx                    Upload Reports
history.tsx                    My Medical History
trends.tsx                     My Health Trends (tabs)
period.tsx                     Period Tracker (female-only guard)
visit-summary.tsx              Doctor Visit Summary
settings.tsx                   Settings
```

Each route gets its own `head()` with title + description.

## Components (src/components/)

- `layout/Header.tsx`, `layout/SideDrawer.tsx`, `layout/ChatFAB.tsx`
- `onboarding/Step1Profile.tsx … Step6Interview.tsx`, `OnboardingShell.tsx` with progress bar
- `home/MedicationCard.tsx`, `home/TodaysLogs.tsx`, `home/LogValueSheet.tsx`, `home/AddCustomLogButton.tsx`, `home/ActivityFeed.tsx`
- `chat/ChatPanel.tsx` (reused by FAB and Interview)
- `trends/TrendTab.tsx` (Recharts LineChart + stats row)
- `period/CalendarView.tsx`, `period/LogPeriodSheet.tsx`
- `summary/SummaryView.tsx` with Download PDF (`window.print()` styled) and Copy
- `reports/Dropzone.tsx`
- `ui/EmptyState.tsx`, `ui/ConfirmDialog.tsx`

## Groq Integration (`src/lib/groq.ts`)

- `chatCompletion({ messages, model })` — fetch wrapper, reads key from localStorage, throws friendly error if missing
- `runInterview(state, userMsg)` — drives sequential questions; system prompt enumerates sections (Diagnosis timeline → Symptoms → Surgeries → Family → Lifestyle) and emits a `[SECTION_COMPLETE:<name>]` token so UI can advance progress bar
- `generateSummary(profile, conditions, meds, interviewAnswers, recentLogs)` — returns structured markdown grouped by section
- `analyzeActivity(recentLogs, meds)` — produces ActivityItems with severity

Key suggestion text + clickable console.groq.com link in Step 5; "Skip for now" allowed (AI features show inline "Add API key in Settings" prompt when invoked without one).

## Auto-suggested Logs (Step 4)

Map per condition (in `src/lib/suggestedLogs.ts`):
- High BP → BP (mmHg, daily AM/PM)
- Diabetes → Glucose (mg/dL, daily fasting + post-meal)
- Depression → Mood (1–10, daily evening)
- Sleep Deprivation → Sleep hours (h, daily AM)
- Thyroid → Weight (kg, weekly), Energy (1–10, daily)
- Asthma → Peak flow (L/min, daily)
- PCOS → Weight + Cycle notes
- Abnormal Periods → Cycle notes (→ also enables Period Tracker prominence)
- Dental Infection → Pain (1–10, daily), Temperature (°C, daily)
"Create Custom Log" form (name, unit, frequency, time). "Approve All" persists list.

## Home Behavior

- Medications: cards filtered by today's schedule; "Mark as Taken" writes a LogEntry `{ metricId: med:<id>, value: 'taken' }`, grays card with checkmark, undoable for 5s via Sonner toast
- Today's Logs: derived from active LogMetrics for today; tap → bottom sheet input; completed entries show value inline; "+ Add Custom Log Metric" creates metric + opens entry sheet immediately
- Activity Feed: regenerated on home mount (debounced 1/hour) via `analyzeActivity`; empty state "All looks good today."

## Period Tracker

Female-only: drawer link + route hidden/redirected for others. Calendar built with `date-fns` + simple grid (no extra dep beyond date-fns). Predict next from average of last 3 cycles.

## Doctor Visit Summary

Renders profile, conditions/meds, latest summary, trends snapshot (mini sparkline per metric), anomalies (from activity feed `warning|critical`), and data gaps (metrics with no entries in 7d). Download PDF via print stylesheet; Copy via `navigator.clipboard`.

## Settings

Editable forms for every persisted slice; destructive actions (remove med, delete metric, reset onboarding) gated by ConfirmDialog. Masked API key with show/hide toggle.

## Dependencies to Add

`recharts`, `date-fns`, `react-markdown` (chat rendering). No Groq SDK needed — fetch is sufficient.

## Build Order

1. Tokens + base layout shell (header, drawer, FAB, route stubs)
2. Storage helpers + types + suggested-logs map
3. Onboarding wizard (steps 1–5) + persistence + redirect logic
4. Groq client + Chat panel + Step 6 interview
5. Home (meds, logs, activity)
6. Trends, Period, Reports, History, Visit Summary, Settings
7. Activity analyzer + empty states + confirm dialogs + polish pass

## Out of Scope

- Real auth/cloud sync (everything local)
- Actual PDF parsing of uploaded reports (stored as files, listed only)
- Push notifications (bell icon is a panel over local activity feed)

Ready to build on approval.