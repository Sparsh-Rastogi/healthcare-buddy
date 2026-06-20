import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Loader2, LogOut, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { BaymaxLogo } from "@/components/layout/BaymaxLogo";
import { useLocalState, KEYS, readLS } from "@/lib/storage";
import type { ActivityItem, Profile } from "@/lib/types";
import { SideDrawerNav } from "./SideDrawer";
import { ChatFAB } from "./ChatFAB";

const PUBLIC_PATHS = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const isOnboarding = path.startsWith("/onboarding");
  const { user, loading, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profile] = useLocalState<Profile | null>(KEYS.profile, null);
  const [activity] = useLocalState<ActivityItem[]>(KEYS.activity, []);

  useEffect(() => setDrawerOpen(false), [path]);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (user && path.startsWith("/login")) {
      const onboarded = readLS<boolean>(KEYS.onboarded, false);
      navigate({ to: onboarded ? "/" : "/onboarding", replace: true });
    }
  }, [user, loading, isPublic, path, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  if (loading && !isPublic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Waking up Baymax…</p>
        </div>
      </div>
    );
  }

  if (isPublic) return <>{children}</>;
  if (isOnboarding) return <>{children}</>;

  const firstName = profile?.name?.split(" ")[0];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print sticky top-0 z-40 bg-background/85 backdrop-blur border-b">
        <div className="mx-auto max-w-5xl flex items-center justify-between h-14 px-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)} aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/">
              <BaymaxLogo size="sm" />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Popover open={bellOpen} onOpenChange={setBellOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {activity.length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 rounded-2xl">
                <div className="font-medium mb-2">Baymax noticed</div>
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All looks calm today. Take care of yourself!</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto">
                    {activity.slice(0, 6).map((a) => (
                      <li key={a.id} className="text-sm rounded-xl bg-muted/50 p-2.5">
                        <div className="font-medium">{a.title}</div>
                        <div className="text-muted-foreground text-xs mt-0.5">{a.body}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-left">
              {firstName ? `Hi, ${firstName} 👋` : "Welcome to Baymax"}
            </SheetTitle>
            {user?.email && (
              <p className="text-xs text-muted-foreground text-left truncate">{user.email}</p>
            )}
          </SheetHeader>
          <SideDrawerNav gender={profile?.gender ?? "na"} onLogout={handleLogout} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 mx-auto max-w-5xl w-full px-3 py-4">{children}</main>
      <ChatFAB />
    </div>
  );
}
