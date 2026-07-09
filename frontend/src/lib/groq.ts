import { KEYS, readLS } from "./storage";
import type { ChatMessage } from "./types";
import { chatApi, BaymaxApiError } from "./baymax-api";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ── Active Groq models (June 2026) ───────────────────────────────────────────
// llama3-70b-8192, mixtral-8x7b-32768, and llama-3.1-8b-instant are decommissioned.
export const DEFAULT_MODEL = "llama-3.3-70b-versatile"; // matches backend GROQ_MODEL
export const MODELS = [
  "llama-3.3-70b-versatile",  // Best all-round — same model as backend agent
  "openai/gpt-oss-120b",      // Most capable (GPT-class open-weight)
  "openai/gpt-oss-20b",       // Fastest / lowest latency
];

export function getApiKey(): string {
  return readLS<string>(KEYS.groqKey, "");
}

export class GroqError extends Error {}

/**
 * Send a chat message.
 *
 * Routing:
 *   1. Try POST /api/v1/chat/message on the BayMax backend (persistent memory,
 *      server-side Groq key, full agent tools).
 *   2. If the backend is unreachable (NetworkError or 5xx), fall back to calling
 *      the Groq API directly from the browser with the localStorage key.
 *
 * The fallback keeps the app fully usable offline / before the backend is running.
 */
export async function chatCompletion(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  /** Optional session ID for backend conversation continuity */
  sessionId?: string;
}): Promise<string> {
  // ── Attempt 1: BayMax backend ────────────────────────────────────────────
  const lastUserMsg = [...opts.messages].reverse().find((m) => m.role === "user")?.content;
  if (lastUserMsg) {
    try {
      const resp = await chatApi.message({ message: lastUserMsg, session_id: opts.sessionId });
      return resp.baymax_response;
    } catch (err) {
      // Only fall through to direct Groq if the backend is genuinely unreachable
      const isNetworkError = err instanceof TypeError; // fetch failed
      const isServerError = err instanceof BaymaxApiError && err.status >= 500;
      if (!isNetworkError && !isServerError) {
        // 4xx — surface the real error (bad auth, etc.)
        throw new GroqError(err instanceof Error ? err.message : String(err));
      }
      console.warn("[BayMax] Backend unreachable — falling back to direct Groq API.");
    }
  }

  // ── Attempt 2: Direct Groq API fallback ─────────────────────────────────
  const key = getApiKey();
  if (!key) throw new GroqError("Add your Groq API key in Settings to use AI features.");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      temperature: opts.temperature ?? 0.4,
      messages: opts.messages,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GroqError(`Groq error (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

export const INTERVIEW_SYSTEM = `You are Baymax, a calm and friendly medical history assistant.
You conduct a structured patient interview covering these SECTIONS, IN ORDER:
1. Diagnosis Timeline — when conditions were diagnosed
2. Symptoms — current symptoms and severity
3. Surgeries — past surgeries / hospitalizations
4. Family History — relevant illnesses in immediate family
5. Lifestyle — diet, exercise, sleep, smoking, alcohol

Rules:
- Ask ONE short, friendly question at a time.
- After the user replies, acknowledge briefly (1 sentence) and ask the next question.
- When a section is fully covered, output the literal token [SECTION_DONE:<name>] on its own line BEFORE the next question.
- When all 5 sections are done, output [INTERVIEW_DONE] and a one-paragraph thank-you. Do not ask further questions.
- Never give medical diagnoses or treatment advice. Suggest consulting a clinician for concerns.`;

export function buildSummaryPrompt(payload: unknown): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are BayMax, a precise clinical documentation assistant.\n\n" +
        "FORMATTING RULES (strictly enforced):\n" +
        "- Output ONLY GitHub-Flavored Markdown. No plain-text paragraphs for structured data.\n" +
        "- Use `##` for section headings (with emoji prefix), `###` for sub-headings.\n" +
        "- Use `**bold**` for field labels (e.g. **Name:**).\n" +
        "- Use bullet points (`-`) for ALL lists. Every section must have at least one bullet.\n" +
        "- Separate each section with a blank line.\n" +
        "- Do NOT add preamble, greeting, or closing remarks outside the defined sections.\n\n" +
        "Output EXACTLY these sections in order:\n" +
        "## 🩺 Patient Profile\n" +
        "## 🏥 Active Conditions\n" +
        "## 💊 Current Medications\n" +
        "## 📊 Vitals Overview (with ### Trends and ### Anomalies sub-sections)\n" +
        "## ✅ Compliance Status\n" +
        "## 💬 Key Observations from Chat\n" +
        "## 🔍 Suggested Follow-up Points\n" +
        "## ⚠️ Disclaimer",
    },
    {
      role: "user",
      content: `Patient data (JSON):\n\n${JSON.stringify(payload, null, 2)}`,
    },
  ];
}

export function buildActivityPrompt(payload: unknown): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a careful health-tracking assistant. Given recent logs, output a JSON array (max 5 items) of objects: {title, body, severity}. Severity is one of 'info','warning','critical'. Only mark 'critical' for obvious red flags (very high BP, very high glucose, missed multiple meds, etc). Output ONLY the JSON array, no prose.",
    },
    { role: "user", content: JSON.stringify(payload) },
  ];
}
