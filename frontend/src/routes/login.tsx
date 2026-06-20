import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BaymaxLogo } from "@/components/layout/BaymaxLogo";
import { useAuth } from "@/contexts/AuthContext";
import { APP_DESCRIPTION, APP_TAGLINE } from "@/lib/brand";
import { isSupabaseConfigured } from "@/lib/supabase";
import { KEYS, readLS } from "@/lib/storage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Baymax" },
      { name: "description", content: APP_DESCRIPTION },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp, signInDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    const onboarded = readLS<boolean>(KEYS.onboarded, false);
    navigate({ to: onboarded ? "/" : "/onboarding", replace: true });
  }, [authLoading, user, navigate]);

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const goNext = () => {
    const onboarded = readLS<boolean>(KEYS.onboarded, false);
    navigate({ to: onboarded ? "/" : "/onboarding" });
  };

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn(email, password);
      toast.success("Welcome back!");
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    setBusy(true);
    try {
      await signUp(email, password);
      toast.success("Account created — welcome!");
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = async () => {
    setBusy(true);
    try {
      await signInDemo(email || "demo@baymax.local");
      toast.success("Signed in with demo mode");
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/80 via-background to-primary/5 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BaymaxLogo size="lg" />
          </div>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">{APP_TAGLINE}</p>
          <p className="text-sm text-muted-foreground/90 max-w-sm mx-auto">{APP_DESCRIPTION}</p>
        </div>

        <Card className="border-primary/10 soft-shadow rounded-2xl">
          <CardContent className="pt-6">
            {supabaseReady ? (
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>
                <AuthFields email={email} setEmail={setEmail} password={password} setPassword={setPassword} />
                <TabsContent value="signin" className="mt-4 space-y-3">
                  <Button className="w-full rounded-xl" disabled={busy} onClick={handleSignIn}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                  </Button>
                </TabsContent>
                <TabsContent value="signup" className="mt-4 space-y-3">
                  <Button className="w-full rounded-xl" disabled={busy} onClick={handleSignUp}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Password must be at least 6 characters.
                  </p>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Supabase isn&apos;t configured yet. Use demo mode to explore Baymax locally.
                </p>
                <AuthFields email={email} setEmail={setEmail} password={password} setPassword={setPassword} hidePassword />
                <Button className="w-full rounded-xl" disabled={busy} onClick={handleDemo}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with demo account"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Add <code className="text-primary">VITE_SUPABASE_URL</code> and{" "}
                  <code className="text-primary">VITE_SUPABASE_ANON_KEY</code> for real accounts.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AuthFields({
  email,
  setEmail,
  password,
  setPassword,
  hidePassword,
}: {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  hidePassword?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl mt-1"
        />
      </div>
      {!hidePassword && (
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl mt-1"
          />
        </div>
      )}
    </div>
  );
}
