import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) client = createClient(url, anonKey);
  return client;
}

/** Build a dev JWT accepted by the backend when DEVELOPMENT_MODE=true */
export function createDevToken(userId: string): string {
  const payload = btoa(JSON.stringify({ sub: userId, iat: Math.floor(Date.now() / 1000) }));
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.dev_signature`;
}
