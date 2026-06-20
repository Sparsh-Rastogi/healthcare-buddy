import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-x/EmptyState";
import { useLocalState, KEYS } from "@/lib/storage";
import type { LogEntry, LogMetric } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: `Health Trends — ${APP_NAME}` },
      { name: "description", content: "Charts for your vitals, mood, sleep, and custom metrics." },
    ],
  }),
  component: TrendsPage,
});

function TrendsPage() {
  const [metrics] = useLocalState<LogMetric[]>(KEYS.metrics, []);
  const [entries] = useLocalState<LogEntry[]>(KEYS.entries, []);
  const numericMetrics = metrics.filter((m) => m.unit !== "text");

  if (numericMetrics.length === 0)
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Health Trends</h1>
        <EmptyState title="Nothing to chart yet" description="Add numeric metrics in Settings and log a few entries to see trends." />
      </div>
    );

  const [active, setActive] = useState(numericMetrics[0].id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Health Trends</h1>
      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="flex-wrap h-auto">
          {numericMetrics.map((m) => (
            <TabsTrigger key={m.id} value={m.id}>{m.name}</TabsTrigger>
          ))}
        </TabsList>
        {numericMetrics.map((m) => (
          <TabsContent key={m.id} value={m.id}>
            <TrendView metric={m} entries={entries.filter((e) => e.metricId === m.id)} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TrendView({ metric, entries }: { metric: LogMetric; entries: LogEntry[] }) {
  const data = useMemo(
    () =>
      entries
        .map((e) => ({ date: e.date, value: Number(e.value), label: fmtDate(e.date) }))
        .filter((d) => !Number.isNaN(d.value))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );
  const stats = useMemo(() => {
    if (data.length === 0) return { avg: 0, hi: 0, lo: 0 };
    const vals = data.map((d) => d.value);
    return {
      avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
      hi: Math.max(...vals),
      lo: Math.min(...vals),
    };
  }, [data]);

  if (data.length === 0)
    return <EmptyState title="No entries yet" description={`Log ${metric.name} to start your chart.`} />;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }} />
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <Stat label="Avg" value={`${stats.avg} ${metric.unit}`} />
          <Stat label="High" value={`${stats.hi} ${metric.unit}`} />
          <Stat label="Low" value={`${stats.lo} ${metric.unit}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}
