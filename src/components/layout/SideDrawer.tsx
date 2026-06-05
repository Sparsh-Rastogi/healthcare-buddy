import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Upload,
  FileText,
  TrendingUp,
  CalendarHeart,
  Stethoscope,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Gender } from "@/lib/types";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/reports", label: "Upload Medical Report", icon: Upload },
  { to: "/history", label: "My Medical History", icon: FileText },
  { to: "/trends", label: "My Health Trends", icon: TrendingUp },
  { to: "/period", label: "Period Tracker", icon: CalendarHeart, femaleOnly: true },
  { to: "/visit-summary", label: "Doctor Visit Summary", icon: Stethoscope },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function SideDrawerNav({ gender }: { gender: Gender }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="p-2">
      <ul className="space-y-1">
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
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
    </nav>
  );
}
