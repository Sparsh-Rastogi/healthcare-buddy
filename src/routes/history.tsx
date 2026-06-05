import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-x/EmptyState";
import { useLocalState, KEYS, readLS } from "@/lib/storage";
import type {
  Condition,
  InterviewAnswer,
  LogEntry,
  Medication,
  MedicalSummary,
  Profile,
} from "@/lib/types";
import { buildSummaryPrompt, chatCompletion, GroqError } from "@/lib/groq";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "My Medical History — Healthcare Buddy" },
      { name: "description", content: "Your full medical summary, generated and refreshed by AI." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [profile] = useLocalState<Profile | null>(KEYS.profile, null);
  const [conditions] = useLocalState<Condition[]>(KEYS.conditions, []);
  const [meds] = useLocalState<Medication[]>(KEYS.meds, []);
  const [interview] = useLocalState<InterviewAnswer[]>(KEYS.interview, []);
  const [summary, setSummary] = useLocalState<MedicalSummary | null>(KEYS.summary, null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setLoading(true);
    try {
      const recent = readLS<LogEntry[]>(KEYS.entries, []).slice(-30);
      const content = await chatCompletion({
        messages: buildSummaryPrompt({ profile, conditions, meds, interview, recent }),
      });
      setSummary({ generatedAt: Date.now(), content });
    } catch (e) {
      setError(e instanceof GroqError ? e.message : "Could not reach Groq.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Medical History</h1>
        <Button onClick={generate} disabled={loading} variant="secondary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Regenerate Summary
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!summary ? (
        <EmptyState
          title="No summary yet"
          description="Generate an AI-formatted summary of your profile, meds, and interview answers."
          action={<Button onClick={generate} disabled={loading}>Generate now</Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground mb-3">
              Last generated {fmtDate(new Date(summary.generatedAt).toISOString().slice(0, 10))}
            </div>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{summary.content}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
