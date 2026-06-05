import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pill, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-x/EmptyState";
import { useLocalState, KEYS, uid, readLS, writeLS } from "@/lib/storage";
import type { ActivityItem, LogEntry, LogMetric, Medication, Severity } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buildActivityPrompt, chatCompletion, getApiKey } from "@/lib/groq";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Healthcare Buddy — Home" },
      { name: "description", content: "Your daily medications, logs, and AI health insights." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [onboarded] = useLocalState<boolean>(KEYS.onboarded, false);
  useEffect(() => {
    if (!onboarded) navigate({ to: "/onboarding" });
  }, [onboarded, navigate]);
  if (!onboarded) return null;

  return (
    <div className="space-y-6 pb-24">
      <section>
        <h1 className="text-xl font-semibold mb-3">Today</h1>
        <MedicationsSection />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-3">Today's Logs</h2>
        <LogsSection />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-3">What your Health Buddy noticed today</h2>
        <ActivitySection />
      </section>
    </div>
  );
}

function MedicationsSection() {
  const [meds] = useLocalState<Medication[]>(KEYS.meds, []);
  const [entries, setEntries] = useLocalState<LogEntry[]>(KEYS.entries, []);
  const today = todayISO();
  const takenIds = useMemo(
    () => new Set(entries.filter((e) => e.date === today && e.metricId.startsWith("med:")).map((e) => e.metricId.slice(4))),
    [entries, today],
  );

  if (meds.length === 0)
    return <EmptyState title="No medications yet" description="Add medications in Settings to see them here." icon={<Pill className="h-5 w-5" />} />;

  const markTaken = (m: Medication) => {
    const id = uid();
    setEntries((prev) => [
      ...prev,
      { id, metricId: `med:${m.id}`, date: today, timestamp: Date.now(), value: "taken" },
    ]);
    toast.success(`Marked ${m.name} as taken`, {
      action: {
        label: "Undo",
        onClick: () => setEntries((prev) => prev.filter((e) => e.id !== id)),
      },
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {meds.map((m) => {
        const taken = takenIds.has(m.id);
        return (
          <Card key={m.id} className={cn("transition-opacity", taken && "opacity-60 bg-muted")}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Pill className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.dosage} · {m.time}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={taken ? "secondary" : "default"}
                disabled={taken}
                onClick={() => markTaken(m)}
              >
                {taken ? "✓ Taken" : "Mark taken"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LogsSection() {
  const [metrics, setMetrics] = useLocalState<LogMetric[]>(KEYS.metrics, []);
  const [entries, setEntries] = useLocalState<LogEntry[]>(KEYS.entries, []);
  const [active, setActive] = useState<LogMetric | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const today = todayISO();

  const todaysEntries = useMemo(() => {
    const map = new Map<string, LogEntry>();
    entries
      .filter((e) => e.date === today && !e.metricId.startsWith("med:"))
      .forEach((e) => map.set(e.metricId, e));
    return map;
  }, [entries, today]);

  if (metrics.length === 0)
    return (
      <EmptyState
        title="No logs scheduled"
        description="Add tracking metrics in Settings to see them here."
        action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Custom Log Metric</Button>}
      />
    );

  return (
    <div className="space-y-2">
      {metrics.map((m) => {
        const entry = todaysEntries.get(m.id);
        return (
          <button
            key={m.id}
            onClick={() => setActive(m)}
            className={cn(
              "w-full text-left bg-card rounded-xl border p-3.5 flex items-center justify-between soft-shadow transition",
              entry ? "border-primary/30" : "hover:bg-muted/50",
            )}
          >
            <div>
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.frequency} · {m.time} · {m.unit}</div>
            </div>
            <div className="text-sm">
              {entry ? (
                <span className="font-medium text-primary">{entry.value} {m.unit !== "text" && m.unit}</span>
              ) : (
                <span className="text-muted-foreground">Tap to log</span>
              )}
            </div>
          </button>
        );
      })}
      <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
        <Plus className="h-4 w-4" /> Add Custom Log Metric
      </Button>

      <LogValueSheet
        metric={active}
        onClose={() => setActive(null)}
        onSave={(value, note) => {
          if (!active) return;
          setEntries((prev) => [
            ...prev.filter((e) => !(e.metricId === active.id && e.date === today)),
            { id: uid(), metricId: active.id, date: today, timestamp: Date.now(), value, note },
          ]);
          setActive(null);
          toast.success(`Logged ${active.name}`);
        }}
      />

      <AddMetricSheet
        open={showAdd}
        onOpenChange={setShowAdd}
        onCreate={(metric) => {
          setMetrics((prev) => [...prev, metric]);
          setShowAdd(false);
          setActive(metric);
        }}
      />
    </div>
  );
}

function LogValueSheet({
  metric,
  onClose,
  onSave,
}: {
  metric: LogMetric | null;
  onClose: () => void;
  onSave: (value: string, note?: string) => void;
}) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    setValue("");
    setNote("");
  }, [metric?.id]);
  return (
    <Sheet open={!!metric} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{metric?.name}</SheetTitle>
        </SheetHeader>
        {metric && (
          <div className="p-4 space-y-3">
            <div>
              <Label>Value ({metric.unit})</Label>
              <Input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`e.g. ${metric.unit === "text" ? "Feeling steady" : "120"}`}
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
            <SheetFooter>
              <Button onClick={() => value.trim() && onSave(value.trim(), note.trim() || undefined)} disabled={!value.trim()}>
                Save log
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AddMetricSheet({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (m: LogMetric) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [freq, setFreq] = useState<LogMetric["frequency"]>("daily");
  const [time, setTime] = useState("09:00");
  useEffect(() => {
    if (open) {
      setName("");
      setUnit("");
      setFreq("daily");
      setTime("09:00");
    }
  }, [open]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>New tracking metric</SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Water intake" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ml, mg, 1-10..." />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Frequency</Label>
            <Select value={freq} onValueChange={(v) => setFreq(v as LogMetric["frequency"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SheetFooter>
            <Button
              disabled={!name.trim() || !unit.trim()}
              onClick={() => onCreate({ id: uid(), name: name.trim(), unit: unit.trim(), frequency: freq, time, source: "custom" })}
            >
              Create & log now
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const SEV_STYLE: Record<Severity, string> = {
  info: "bg-info text-info-foreground",
  warning: "bg-warning text-warning-foreground",
  critical: "bg-destructive text-destructive-foreground",
};

function ActivitySection() {
  const [activity, setActivity] = useLocalState<ActivityItem[]>(KEYS.activity, []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const lastRun = readLS<number>("activityRun", 0);
    const meds = readLS<Medication[]>(KEYS.meds, []);
    const entries = readLS<LogEntry[]>(KEYS.entries, []);
    if (!getApiKey() || meds.length === 0) return;
    if (Date.now() - lastRun < 1000 * 60 * 60) return;
    const recent = entries.slice(-30);
    setLoading(true);
    chatCompletion({
      messages: buildActivityPrompt({ meds, recentEntries: recent }),
      temperature: 0.2,
    })
      .then((text) => {
        try {
          const cleaned = text.replace(/```json|```/g, "").trim();
          const arr = JSON.parse(cleaned) as { title: string; body: string; severity: Severity }[];
          const items: ActivityItem[] = arr.slice(0, 5).map((a) => ({
            id: uid(),
            date: todayISO(),
            title: a.title,
            body: a.body,
            severity: a.severity,
          }));
          setActivity(items);
          writeLS("activityRun", Date.now());
        } catch {
          /* ignore parse errors */
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && activity.length === 0)
    return (
      <div className="rounded-2xl bg-card border p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Reviewing your recent data…
      </div>
    );

  if (activity.length === 0)
    return <EmptyState title="All looks good today" description="Your Health Buddy hasn't spotted anything to flag." />;

  return (
    <ul className="space-y-2">
      {activity.map((a) => (
        <li key={a.id} className="rounded-xl bg-card border p-3.5 soft-shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{a.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{a.body}</div>
            </div>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SEV_STYLE[a.severity])}>
              {a.severity}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
