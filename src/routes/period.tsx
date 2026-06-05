import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-x/EmptyState";
import { useLocalState, KEYS, uid } from "@/lib/storage";
import type { PeriodEntry, Profile } from "@/lib/types";
import { fmtDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/period")({
  head: () => ({
    meta: [
      { title: "Period Tracker — Healthcare Buddy" },
      { name: "description", content: "Log your cycle, see predictions and trends." },
    ],
  }),
  component: PeriodPage,
});

function PeriodPage() {
  const [profile] = useLocalState<Profile | null>(KEYS.profile, null);
  if (profile && profile.gender !== "female") return <Navigate to="/" />;
  const [periods, setPeriods] = useLocalState<PeriodEntry[]>(KEYS.periods, []);
  const [cursor, setCursor] = useState(new Date());
  const [open, setOpen] = useState(false);

  const periodDays = useMemo(() => {
    const set = new Set<string>();
    periods.forEach((p) => {
      const start = parseISO(p.startDate);
      const end = p.endDate ? parseISO(p.endDate) : addDays(start, 4);
      eachDayOfInterval({ start, end }).forEach((d) => set.add(format(d, "yyyy-MM-dd")));
    });
    return set;
  }, [periods]);

  const { prediction, avgLen } = useMemo(() => {
    const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (sorted.length < 2) return { prediction: null as string | null, avgLen: 0 };
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(differenceInDays(parseISO(sorted[i].startDate), parseISO(sorted[i - 1].startDate)));
    }
    const avg = Math.round(gaps.slice(-3).reduce((a, b) => a + b, 0) / Math.min(gaps.length, 3));
    const last = sorted[sorted.length - 1];
    return { prediction: format(addDays(parseISO(last.startDate), avg), "yyyy-MM-dd"), avgLen: avg };
  }, [periods]);

  const start = startOfWeek(startOfMonth(cursor));
  const end = endOfWeek(endOfMonth(cursor));
  const days = eachDayOfInterval({ start, end });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Period Tracker</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Log Period</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="font-medium">{format(cursor, "MMMM yyyy")}</div>
            <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const isPeriod = periodDays.has(key);
              const isPredicted = prediction === key;
              const isToday = isSameDay(d, new Date());
              const otherMonth = d.getMonth() !== cursor.getMonth();
              return (
                <div
                  key={key}
                  className={cn(
                    "aspect-square rounded-lg flex items-center justify-center text-sm",
                    otherMonth && "text-muted-foreground/40",
                    isPeriod && "bg-rose text-rose-foreground font-medium",
                    isPredicted && !isPeriod && "ring-2 ring-rose ring-offset-1",
                    isToday && !isPeriod && "bg-primary/15 text-primary font-medium",
                  )}
                >
                  {d.getDate()}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Predicted next</div>
          <div className="font-semibold mt-0.5">{prediction ? fmtDate(prediction) : "Log 2+ cycles"}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Avg cycle length</div>
          <div className="font-semibold mt-0.5">{avgLen ? `${avgLen} days` : "—"}</div>
        </CardContent></Card>
      </div>

      <div>
        <h2 className="font-medium mb-2">History</h2>
        {periods.length === 0 ? (
          <EmptyState title="No cycles logged yet" description="Tap 'Log Period' to add your first entry." />
        ) : (
          <div className="space-y-2">
            {[...periods].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((p) => (
              <Card key={p.id}><CardContent className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="font-medium">{fmtDate(p.startDate)}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.intensity} · {p.symptoms.length ? p.symptoms.join(", ") : "no symptoms"}
                  </div>
                </div>
              </CardContent></Card>
            ))}
          </div>
        )}
      </div>

      <LogPeriodSheet
        open={open}
        onOpenChange={setOpen}
        onSave={(p) => {
          setPeriods((prev) => [...prev, p]);
          setOpen(false);
        }}
      />
    </div>
  );
}

const SYMPTOMS = ["Cramps", "Headache", "Bloating", "Mood swings", "Fatigue", "Acne"];

function LogPeriodSheet({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (p: PeriodEntry) => void;
}) {
  const [start, setStart] = useState(todayISO());
  const [intensity, setIntensity] = useState<PeriodEntry["intensity"]>("medium");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader><SheetTitle>Log Period</SheetTitle></SheetHeader>
        <div className="p-4 space-y-3">
          <div>
            <Label>Start date</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label>Intensity</Label>
            <Select value={intensity} onValueChange={(v) => setIntensity(v as PeriodEntry["intensity"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="heavy">Heavy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Symptoms</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {SYMPTOMS.map((s) => {
                const on = symptoms.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s) : [...symptoms, s])}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-sm",
                      on ? "bg-rose text-rose-foreground border-rose" : "bg-card hover:bg-muted",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <SheetFooter>
            <Button onClick={() => onSave({ id: uid(), startDate: start, intensity, symptoms })}>Save</Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
