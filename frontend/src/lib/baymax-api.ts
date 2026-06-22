import { KEYS, readLS } from "@/lib/storage";
import type { Profile } from "@/lib/types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

export class BaymaxApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BaymaxApiError";
    this.status = status;
  }
}

function getAuthToken(): string {
  return readLS<string>(KEYS.authToken, "");
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (token) headers.set("Authorization", `Bearer ${token}`);

  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* ignore */
    }
    throw new BaymaxApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VitalsPayload {
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  blood_glucose?: number;
  weight?: number;
  temperature?: number;
  spo2?: number;
  notes?: string;
}

export interface CompliancePayload {
  measure: string;
  completed: boolean;
  notes?: string;
  log_date?: string;
}

export interface CyclePayload {
  cycle_start: string;
  cycle_end?: string;
  symptoms?: string[];
  notes?: string;
}

export interface ReportRecord {
  id: string;
  user_id: string;
  drive_file_id: string;
  filename: string;
  mime_type?: string;
  uploaded_at: string;
  parsed: boolean;
  extracted_vitals?: Record<string, unknown> | null;
  parse_error?: string | null;
}

export interface AgentLogRecord {
  id: string;
  user_id: string;
  timestamp: string;
  action: string;
  reasoning?: string | null;
  severity: "info" | "warning" | "critical";
  tool_used?: string | null;
  result?: string | null;
}

export interface UserProfilePayload {
  name: string;
  email: string;
  emergency_contact?: string;
  doctor_instructions?: string;
  groq_api_key?: string;
  conditions?: string[];
  medications?: Array<{ name: string; dosage: string; time: string }>;
}

// ─── API modules ──────────────────────────────────────────────────────────────

export const vitalsApi = {
  log: (body: VitalsPayload) =>
    apiFetch<Record<string, unknown>>("/vitals/log", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  history: (page = 1, pageSize = 20) =>
    apiFetch<Record<string, unknown>[]>(`/vitals/history?page=${page}&page_size=${pageSize}`),
  trend: (days = 7) => apiFetch<{ entries: Record<string, unknown>[] }>(`/vitals/trend?days=${days}`),
};

export const complianceApi = {
  log: (body: CompliancePayload) =>
    apiFetch<Record<string, unknown>>("/compliance/log", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  status: () => apiFetch<Record<string, unknown>>("/compliance/status"),
};

export const cycleApi = {
  log: (body: CyclePayload) =>
    apiFetch<Record<string, unknown>>("/cycle/log", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  history: () => apiFetch<Record<string, unknown>[]>("/cycle/history"),
};

export const reportsApi = {
  list: () => apiFetch<{ reports: ReportRecord[] }>("/reports/list"),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<ReportRecord>("/reports/upload", { method: "POST", body: form });
  },
};

export const agentApi = {
  logs: (page = 1, pageSize = 20) =>
    apiFetch<{ logs: AgentLogRecord[] }>(`/agent/logs?page=${page}&page_size=${pageSize}`),
};

export const summaryApi = {
  generate: () => apiFetch<{ summary: string }>("/summary/generate", { method: "POST" }),
  latest: () => apiFetch<{ summary: string }>("/summary/latest"),
};

export const userApi = {
  upsertProfile: (body: UserProfilePayload) =>
    apiFetch<Record<string, unknown>>("/users/profile", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getProfile: () => apiFetch<Record<string, unknown>>("/users/profile"),
};

export const chatApi = {
  message: (body: { message: string; session_id?: string }) =>
    apiFetch<{ baymax_response: string; session_id: string }>("/chat/message", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  history: (sessionId: string) =>
    apiFetch<{ messages: Record<string, unknown>[] }>(`/chat/history?session_id=${encodeURIComponent(sessionId)}`),
};

/** Push local profile, conditions, meds, Groq key, and emergency contact to the backend. */
export async function syncProfileToBackend(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  const profile = readLS<Profile | null>(KEYS.profile, null);
  const authUser = readLS<{ id: string; email: string } | null>(KEYS.authUser, null);
  const groqKey = readLS<string>(KEYS.groqKey, "");
  const emergency = readLS<{ name: string; phone: string; relationship: string }>(KEYS.emergency, {
    name: "",
    phone: "",
    relationship: "",
  });
  const conditions = readLS<Array<{ id: string; label: string }>>(KEYS.conditions, []);
  const meds = readLS<Array<{ id: string; name: string; dosage: string; time: string }>>(KEYS.meds, []);

  if (!profile?.name) return;

  const email = authUser?.email || "local@baymax.local";
  const emergencyContact = emergency.phone
    ? `${emergency.name} (${emergency.relationship}): ${emergency.phone}`
    : undefined;

  await userApi.upsertProfile({
    name: profile.name,
    email,
    emergency_contact: emergencyContact,
    groq_api_key: groqKey || undefined,
    conditions: conditions.map((c) => c.label),
    medications: meds.map(({ name, dosage, time }) => ({ name, dosage, time })),
  });
}

/** Alias used by the settings page for clarity — same as syncProfileToBackend. */
export { syncProfileToBackend as syncSettingsToBackend };

export async function isBackendReachable(): Promise<boolean> {
  try {
    const base = API_BASE.replace(/\/api\/v1\/?$/, "");
    const res = await fetch(`${base}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}