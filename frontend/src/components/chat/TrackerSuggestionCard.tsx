import { useState } from "react";
import { Plus, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KEYS, readLS, uid, writeLS } from "@/lib/storage";
import type { LogMetric, TrackerSuggestion } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  suggestions: TrackerSuggestion[];
}

/** Key used to persist which trackers have already been added (by name). */
const ADDED_KEY = "addedTrackers";

function getAdded(): Set<string> {
  return new Set<string>(readLS<string[]>(ADDED_KEY, []));
}

function markAdded(name: string) {
  const current = readLS<string[]>(ADDED_KEY, []);
  writeLS(ADDED_KEY, [...current, name.toLowerCase()]);
}

function frequencyLabel(f: TrackerSuggestion["frequency"]): string {
  switch (f) {
    case "daily":        return "Daily";
    case "every_3_days": return "Every 3 days";
    case "weekly":       return "Weekly";
    default:             return f;
  }
}

/** Map every_3_days → custom so it's compatible with LogMetric's frequency field. */
function toLogFrequency(f: TrackerSuggestion["frequency"]): LogMetric["frequency"] {
  if (f === "every_3_days") return "custom";
  return f as LogMetric["frequency"];
}

function TrackerCard({ s }: { s: TrackerSuggestion }) {
  const [added, setAdded] = useState(() =>
    getAdded().has(s.name.toLowerCase())
  );

  const handleAdd = () => {
    // Build a LogMetric and push it into localStorage
    const newMetric: LogMetric = {
      id: uid(),
      name: s.name,
      unit: s.unit,
      frequency: toLogFrequency(s.frequency),
      time: s.time,
      source: "suggested",
    };

    const existing = readLS<LogMetric[]>(KEYS.metrics, []);
    // Guard against duplicates by name (case-insensitive)
    const alreadyExists = existing.some(
      (m) => m.name.toLowerCase() === s.name.toLowerCase()
    );
    if (!alreadyExists) {
      writeLS(KEYS.metrics, [...existing, newMetric]);
    }

    markAdded(s.name);
    setAdded(true);
    toast.success(`✓ "${s.name}" added to your daily logs`, {
      description: `${frequencyLabel(s.frequency)} · ${s.unit}`,
    });
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card p-3 transition-all duration-200",
        added
          ? "border-primary/30 bg-primary/5 opacity-75"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      {/* Icon */}
      <span className="text-2xl leading-none mt-0.5 shrink-0" aria-hidden>
        {s.icon}
      </span>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-sm">{s.name}</span>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {frequencyLabel(s.frequency)}
          </span>
          <span className="text-xs text-muted-foreground">· {s.unit}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {s.reason}
        </p>
      </div>

      {/* Add button */}
      <Button
        size="sm"
        variant={added ? "secondary" : "default"}
        disabled={added}
        onClick={handleAdd}
        className="shrink-0 h-8 px-3 text-xs gap-1.5"
      >
        {added ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Added
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" />
            Add
          </>
        )}
      </Button>
    </div>
  );
}

export function TrackerSuggestionCard({ suggestions }: Props) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-base">💡</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Suggested Trackers
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {suggestions.map((s) => (
          <TrackerCard key={s.name} s={s} />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground px-1">
        Tap <strong>Add</strong> to include a tracker in your daily logs on the home screen.
      </p>
    </div>
  );
}
