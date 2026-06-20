import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createDevToken, getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { KEYS, readLS, writeLS } from "@/lib/storage";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInDemo: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persistSession(accessToken: string, user: AuthUser, demo: boolean) {
  writeLS(KEYS.authToken, accessToken);
  writeLS(KEYS.authUser, user);
  writeLS(KEYS.isDemoAuth, demo);
}

function clearSession() {
  writeLS(KEYS.authToken, "");
  writeLS(KEYS.authUser, null);
  writeLS(KEYS.isDemoAuth, false);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readLS<AuthUser | null>(KEYS.authUser, null));
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(() => readLS<boolean>(KEYS.isDemoAuth, false));

  useEffect(() => {
    const supabase = getSupabase();

    if (!supabase) {
      const token = readLS<string>(KEYS.authToken, "");
      const saved = readLS<AuthUser | null>(KEYS.authUser, null);
      setUser(token && saved ? saved : null);
      setIsDemo(readLS<boolean>(KEYS.isDemoAuth, false));
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session?.user) {
        const next: AuthUser = { id: session.user.id, email: session.user.email ?? "" };
        persistSession(session.access_token, next, false);
        setUser(next);
        setIsDemo(false);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const next: AuthUser = { id: session.user.id, email: session.user.email ?? "" };
        persistSession(session.access_token, next, false);
        setUser(next);
        setIsDemo(false);
      } else {
        clearSession();
        setUser(null);
        setIsDemo(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured. Use demo sign-in or add env vars.");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session?.user) throw new Error("Sign in failed — no session returned.");

    const next: AuthUser = { id: data.session.user.id, email: data.session.user.email ?? email };
    persistSession(data.session.access_token, next, false);
    setUser(next);
    setIsDemo(false);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured. Use demo sign-in or add env vars.");

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.session?.user) {
      const next: AuthUser = { id: data.session.user.id, email: data.session.user.email ?? email };
      persistSession(data.session.access_token, next, false);
      setUser(next);
      setIsDemo(false);
      return;
    }

    throw new Error("Check your email to confirm your account, then sign in.");
  }, []);

  const signInDemo = useCallback(async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) throw new Error("Enter an email to continue.");
    const userId = trimmed.replace(/[^a-z0-9@._-]/gi, "").slice(0, 36) || "demo-user";
    const token = createDevToken(userId);
    const next: AuthUser = { id: userId, email: trimmed };
    persistSession(token, next, true);
    setUser(next);
    setIsDemo(true);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase && !isDemo) await supabase.auth.signOut();
    clearSession();
    setUser(null);
    setIsDemo(false);
  }, [isDemo]);

  const value = useMemo(
    () => ({ user, loading, isDemo, signIn, signUp, signInDemo, signOut }),
    [user, loading, isDemo, signIn, signUp, signInDemo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
