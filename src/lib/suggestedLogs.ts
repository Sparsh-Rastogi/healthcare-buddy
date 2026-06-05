import type { LogMetric } from "./types";
import { uid } from "./storage";

type Suggestion = Omit<LogMetric, "id" | "source">;

const MAP: Record<string, Suggestion[]> = {
  "High BP": [
    { name: "Blood Pressure (Systolic)", unit: "mmHg", frequency: "daily", time: "08:00" },
    { name: "Blood Pressure (Diastolic)", unit: "mmHg", frequency: "daily", time: "08:00" },
  ],
  Diabetes: [
    { name: "Fasting Glucose", unit: "mg/dL", frequency: "daily", time: "07:00" },
    { name: "Post-meal Glucose", unit: "mg/dL", frequency: "daily", time: "14:00" },
  ],
  Depression: [{ name: "Mood", unit: "1-10", frequency: "daily", time: "20:00" }],
  "Dental Infection": [
    { name: "Pain Level", unit: "1-10", frequency: "daily", time: "10:00" },
    { name: "Temperature", unit: "°C", frequency: "daily", time: "10:00" },
  ],
  "Sleep Deprivation": [{ name: "Sleep Hours", unit: "hours", frequency: "daily", time: "08:00" }],
  "Abnormal Periods": [{ name: "Cycle Notes", unit: "text", frequency: "daily", time: "09:00" }],
  Thyroid: [
    { name: "Weight", unit: "kg", frequency: "weekly", time: "08:00" },
    { name: "Energy Level", unit: "1-10", frequency: "daily", time: "18:00" },
  ],
  Asthma: [{ name: "Peak Flow", unit: "L/min", frequency: "daily", time: "08:00" }],
  PCOS: [
    { name: "Weight", unit: "kg", frequency: "weekly", time: "08:00" },
    { name: "Cycle Notes", unit: "text", frequency: "daily", time: "09:00" },
  ],
};

export const CONDITION_OPTIONS = Object.keys(MAP);

export function suggestedMetricsFor(conditions: string[]): LogMetric[] {
  const seen = new Set<string>();
  const out: LogMetric[] = [];
  for (const c of conditions) {
    const list = MAP[c] || [];
    for (const s of list) {
      const key = s.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...s, id: uid(), source: "suggested" });
    }
  }
  return out;
}
