import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Upload,
  FileText,
  TrendingUp,
  CalendarHeart,
  Stethoscope,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Gender } from "@/lib/types";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/reports", label: "Upload Report", icon: Upload },
  { to: "/history", label: "Medical History", icon: FileText },
  { to: "/trends", label: "Health Trends", icon: TrendingUp },
  { to: "/period", label: "Period Tracker", icon: CalendarHeart, femaleOnly: true },
  { to: "/visit-summary", label: "Doctor Visit Summary", icon: Stethoscope },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function SideDrawerNav({
  gender,
  onLogout,
}: {
  gender: Gender;
  onLogout: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="p-2 flex flex-col h-[calc(100%-5rem)]">
      <ul className="space-y-1 flex-1">
        {items
          .filter((i) => !("femaleOnly" in i && i.femaleOnly) || gender === "female")
          .map((i) => {
            const Icon = i.icon;
            const active = path === i.to;
            return (
              <li key={i.to}>
                <Link
                  to={i.to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                    active
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {i.label}
                </Link>
              </li>
            );
          })}
      </ul>
      <Button
        variant="ghost"
        className="w-full justify-start gap-3 rounded-xl text-muted-foreground hover:text-destructive"
        onClick={onLogout}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </nav>
  );
}
