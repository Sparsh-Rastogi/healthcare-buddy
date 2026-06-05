import { KEYS, readLS } from "./storage";
import type { ChatMessage } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_MODEL = "llama3-70b-8192";
export const MODELS = ["llama3-70b-8192", "mixtral-8x7b-32768", "llama-3.1-8b-instant"];

export function getApiKey(): string {
  return readLS<string>(KEYS.groqKey, "");
}

export class GroqError extends Error {}

export async function chatCompletion(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
}): Promise<string> {
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

export const INTERVIEW_SYSTEM = `You are a calm, professional medical history assistant for Healthcare Buddy.
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
        "You are a clinical scribe. Produce a concise, well-structured Markdown medical summary with headings: Profile, Conditions, Medications, Symptoms, Surgeries, Family History, Lifestyle, Recent Trends, Notes. Use bullet points. Be neutral and factual. End with a short 'For clinician review' disclaimer.",
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
