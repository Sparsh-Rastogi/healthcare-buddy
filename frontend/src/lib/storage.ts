import { useCallback, useEffect, useState } from "react";

const PREFIX = "hb:";

export const KEYS = {
  profile: "profile",
  conditions: "conditions",
  meds: "meds",
  metrics: "metrics",
  entries: "entries",
  periods: "periods",
  reports: "reports",
  activity: "activity",
  interview: "interview",
  summary: "summary",
  groqKey: "groqKey",
  emergency: "emergency",
  onboarded: "onboarded",
  // Auth
  authToken: "authToken",
  authUser: "authUser",
  isDemoAuth: "isDemoAuth",
  backendUserId: "backendUserId",
} as const;

export function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("hb:storage", { detail: { key } }));
  } catch {
    /* noop */
  }
}

export function clearAllHB() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => window.localStorage.removeItem(k));
  window.dispatchEvent(new CustomEvent("hb:storage", { detail: { key: "*" } }));
}

export function useLocalState<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void] {
  const [state, setState] = useState<T>(() => readLS<T>(key, fallback));

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key: string } | undefined;
      if (!detail || detail.key === key || detail.key === "*") {
        setState(readLS<T>(key, fallback));
      }
    };
    window.addEventListener("hb:storage", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("hb:storage", onChange);
      window.removeEventListener("storage", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setAndPersist = useCallback(
    (v: T | ((p: T) => T)) => {
      setState((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        writeLS(key, next);
        return next;
      });
    },
    [key],
  );

  return [state, setAndPersist];
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
