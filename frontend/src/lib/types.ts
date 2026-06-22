export type Gender = "male" | "female" | "na";

export interface Profile {
  name: string;
  age: number | "";
  gender: Gender;
  city: string;
}

export interface Condition {
  id: string;
  label: string;
  custom?: boolean;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string; // HH:MM
}

export type Frequency = "daily" | "every_3_days" | "weekly" | "custom";

export interface LogMetric {
  id: string;
  name: string;
  unit: string;
  frequency: Frequency;
  time: string; // suggested time of day, e.g. "08:00"
  source: "suggested" | "custom";
}

export interface LogEntry {
  id: string;
  metricId: string;
  date: string; // ISO date (YYYY-MM-DD)
  timestamp: number;
  value: string;
  note?: string;
}

export interface PeriodEntry {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  intensity: "light" | "medium" | "heavy";
  symptoms: string[];
}

export interface ReportFile {
  id: string;
  name: string;
  date: string;
  type: "lab" | "prescription" | "other";
  size: number;
}

export type Severity = "info" | "warning" | "critical";

export interface ActivityItem {
  id: string;
  date: string;
  title: string;
  body: string;
  severity: Severity;
}

export interface InterviewAnswer {
  question: string;
  answer: string;
  section: string;
}

export interface MedicalSummary {
  generatedAt: number;
  content: string; // markdown
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  suggestions?: TrackerSuggestion[];
}

export interface TrackerSuggestion {
  name: string;
  unit: string;
  frequency: Frequency;
  time: string;   // HH:MM
  reason: string;
  icon: string;   // single emoji
}
