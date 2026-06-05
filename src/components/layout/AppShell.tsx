import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Bell, HeartPulse } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocalState, KEYS } from "@/lib/storage";
import type { ActivityItem, Profile } from "@/lib/types";
import { SideDrawerNav } from "./SideDrawer";
import { ChatFAB } from "./ChatFAB";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isOnboarding = path.startsWith("/onboarding");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profile] = useLocalState<Profile | null>(KEYS.profile, null);
  const [activity] = useLocalState<ActivityItem[]>(KEYS.activity, []);

  useEffect(() => setDrawerOpen(false), [path]);

  if (isOnboarding) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print sticky top-0 z-40 bg-background/85 backdrop-blur border-b">
        <div className="mx-auto max-w-5xl flex items-center justify-between h-14 px-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)} aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary/15 text-primary">
                <HeartPulse className="h-4 w-4" />
              </span>
              <span className="text-base">Healthcare Buddy</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Popover open={bellOpen} onOpenChange={setBellOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {activity.length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="font-medium mb-2">Recent activity</div>
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All looks good today.</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto">
                    {activity.slice(0, 6).map((a) => (
                      <li key={a.id} className="text-sm">
                        <div className="font-medium">{a.title}</div>
                        <div className="text-muted-foreground text-xs">{a.body}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-left">
              {profile?.name ? `Hi, ${profile.name.split(" ")[0]}` : "Healthcare Buddy"}
            </SheetTitle>
          </SheetHeader>
          <SideDrawerNav gender={profile?.gender ?? "na"} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 mx-auto max-w-5xl w-full px-3 py-4">{children}</main>
      <ChatFAB />
    </div>
  );
}
