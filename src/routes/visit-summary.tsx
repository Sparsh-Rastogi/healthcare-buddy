import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocalState, KEYS } from "@/lib/storage";
import type {
  ActivityItem,
  Condition,
  LogEntry,
  LogMetric,
  Medication,
  MedicalSummary,
  Profile,
} from "@/lib/types";
import { fmtDate, todayISO } from "@/lib/format";
import { differenceInDays, parseISO } from "date-fns";

export const Route = createFileRoute("/visit-summary")({
  head: () => ({
    meta: [
      { title: "Doctor Visit Summary — Healthcare Buddy" },
      { name: "description", content: "A printable summary for your next appointment." },
    ],
  }),
  component: VisitSummary,
});

function VisitSummary() {
  const [profile] = useLocalState<Profile | null>(KEYS.profile, null);
  const [conditions] = useLocalState<Condition[]>(KEYS.conditions, []);
  const [meds] = useLocalState<Medication[]>(KEYS.meds, []);
  const [metrics] = useLocalState<LogMetric[]>(KEYS.metrics, []);
  const [entries] = useLocalState<LogEntry[]>(KEYS.entries, []);
  const [activity] = useLocalState<ActivityItem[]>(KEYS.activity, []);
  const [summary] = useLocalState<MedicalSummary | null>(KEYS.summary, null);

  const trends = useMemo(() => metrics.filter((m) => m.unit !== "text").map((m) => {
    const vals = entries.filter((e) => e.metricId === m.id).map((e) => Number(e.value)).filter((n) => !Number.isNaN(n));
    if (vals.length === 0) return { name: m.name, unit: m.unit, avg: null as number | null, n: 0 };
    return {
      name: m.name,
      unit: m.unit,
      avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
      n: vals.length,
    };
  }), [metrics, entries]);

  const gaps = useMemo(() => {
    const today = parseISO(todayISO());
    return metrics.filter((m) => {
      const last = entries.filter((e) => e.metricId === m.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!last) return true;
      return differenceInDays(today, parseISO(last.date)) > 7;
    });
  }, [metrics, entries]);

  const anomalies = activity.filter((a) => a.severity !== "info");

  const buildText = () => {
    const lines = [
      `# Healthcare Buddy — Doctor Visit Summary`,
      `Generated: ${fmtDate(todayISO())}`,
      ``,
      `## Patient`,
      `- Name: ${profile?.name || "—"}`,
      `- Age: ${profile?.age || "—"}`,
      `- Gender: ${profile?.gender || "—"}`,
      `- City: ${profile?.city || "—"}`,
      ``,
      `## Conditions`,
      ...(conditions.length ? conditions.map((c) => `- ${c.label}`) : ["- None recorded"]),
      ``,
      `## Medications`,
      ...(meds.length ? meds.map((m) => `- ${m.name} ${m.dosage} @ ${m.time}`) : ["- None recorded"]),
      ``,
      `## Recent trends`,
      ...trends.map((t) => t.avg === null ? `- ${t.name}: no data` : `- ${t.name}: avg ${t.avg} ${t.unit} (n=${t.n})`),
      ``,
      `## Anomalies`,
      ...(anomalies.length ? anomalies.map((a) => `- [${a.severity}] ${a.title} — ${a.body}`) : ["- None"]),
      ``,
      `## Data gaps (no entry in 7+ days)`,
      ...(gaps.length ? gaps.map((g) => `- ${g.name}`) : ["- None"]),
      ``,
      summary ? `## AI summary\n\n${summary.content}` : "",
    ];
    return lines.join("\n");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(buildText());
    toast.success("Summary copied to clipboard");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <h1 className="text-xl font-semibold">Doctor Visit Summary</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copy}><Copy className="h-4 w-4" /> Copy</Button>
          <Button onClick={() => window.print()}><Download className="h-4 w-4" /> Download PDF</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 prose prose-sm max-w-none">
          <ReactMarkdown>{buildText()}</ReactMarkdown>
        </CardContent>
      </Card>
    </div>
  );
}
