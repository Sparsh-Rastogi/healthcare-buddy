import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, X, Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { KEYS, uid, writeLS, readLS } from "@/lib/storage";
import { CONDITION_OPTIONS, suggestedMetricsFor } from "@/lib/suggestedLogs";
import type {
  Condition,
  InterviewAnswer,
  LogMetric,
  Medication,
  Profile,
  ChatMessage,
} from "@/lib/types";
import { INTERVIEW_SYSTEM, chatCompletion, GroqError } from "@/lib/groq";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: `Welcome — ${APP_NAME}` },
      { name: "description", content: "Set up your health profile with Baymax in a few quick steps." },
    ],
  }),
  component: Onboarding,
});

const TOTAL_STEPS = 6;

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Profile>(
    () => readLS<Profile | null>(KEYS.profile, null) ?? { name: "", age: "", gender: "na", city: "" },
  );
  const [conditions, setConditions] = useState<Condition[]>(
    () => readLS<Condition[]>(KEYS.conditions, []),
  );
  const [meds, setMeds] = useState<Medication[]>(() => readLS<Medication[]>(KEYS.meds, []));
  const [metrics, setMetrics] = useState<LogMetric[]>(() => readLS<LogMetric[]>(KEYS.metrics, []));
  const [apiKey, setApiKey] = useState(() => readLS<string>(KEYS.groqKey, ""));

  // refresh suggested metrics when entering step 4 first time
  useEffect(() => {
    if (step === 4 && metrics.length === 0) {
      setMetrics(suggestedMetricsFor(conditions.map((c) => c.label)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const completeOnboarding = (answers: InterviewAnswer[]) => {
    writeLS(KEYS.profile, profile);
    writeLS(KEYS.conditions, conditions);
    writeLS(KEYS.meds, meds);
    writeLS(KEYS.metrics, metrics);
    writeLS(KEYS.groqKey, apiKey);
    writeLS(KEYS.interview, answers);
    writeLS(KEYS.onboarded, true);
    navigate({ to: "/" });
  };

  const persistStep = () => {
    if (step === 1) writeLS(KEYS.profile, profile);
    if (step === 2) writeLS(KEYS.conditions, conditions);
    if (step === 3) writeLS(KEYS.meds, meds);
    if (step === 4) writeLS(KEYS.metrics, metrics);
    if (step === 5) writeLS(KEYS.groqKey, apiKey);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/60 to-background flex flex-col">
      <div className="mx-auto max-w-xl w-full px-4 py-6 flex-1 flex flex-col">
        <div className="mb-4 text-center">
          <p className="text-sm font-medium text-primary mb-2">Meet {APP_NAME}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step} of {TOTAL_STEPS}</span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <Progress value={(step / TOTAL_STEPS) * 100} />
        </div>

        <div className="flex-1">
          {step === 1 && <Step1 profile={profile} setProfile={setProfile} />}
          {step === 2 && <Step2 conditions={conditions} setConditions={setConditions} />}
          {step === 3 && <Step3 meds={meds} setMeds={setMeds} />}
          {step === 4 && (
            <Step4 metrics={metrics} setMetrics={setMetrics} conditions={conditions.map((c) => c.label)} />
          )}
          {step === 5 && <Step5 apiKey={apiKey} setApiKey={setApiKey} />}
          {step === 6 && (
            <Step6Interview
              hasKey={!!apiKey}
              context={{ profile, conditions, meds }}
              onComplete={completeOnboarding}
            />
          )}
        </div>

        {step < 6 && (
          <div className="flex justify-between gap-3 pt-4">
            <Button variant="ghost" onClick={back} disabled={step === 1}>
              Back
            </Button>
            <Button
              onClick={() => {
                persistStep();
                next();
              }}
              disabled={step === 1 && (!profile.name || !profile.age)}
            >
              {step === 5 ? "Continue" : "Next"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function Step1({ profile, setProfile }: { profile: Profile; setProfile: (p: Profile) => void }) {
  return (
    <div>
      <Heading title="Welcome 👋" sub="A few basics so Baymax can personalize your experience." />
      <div className="space-y-4">
        <div>
          <Label>Full name</Label>
          <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Jane Doe" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Age</Label>
            <Input
              type="number"
              value={profile.age}
              onChange={(e) => setProfile({ ...profile, age: e.target.value ? Number(e.target.value) : "" })}
              placeholder="34"
            />
          </div>
          <div>
            <Label>City</Label>
            <Input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} placeholder="Mumbai" />
          </div>
        </div>
        <div>
          <Label>Gender</Label>
          <Select value={profile.gender} onValueChange={(v) => setProfile({ ...profile, gender: v as Profile["gender"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="na">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function Step2({ conditions, setConditions }: { conditions: Condition[]; setConditions: (c: Condition[]) => void }) {
  const [custom, setCustom] = useState("");
  const labels = new Set(conditions.map((c) => c.label));
  const toggle = (label: string) => {
    if (labels.has(label)) setConditions(conditions.filter((c) => c.label !== label));
    else setConditions([...conditions, { id: uid(), label }]);
  };
  const addCustom = () => {
    if (!custom.trim() || labels.has(custom.trim())) return;
    setConditions([...conditions, { id: uid(), label: custom.trim(), custom: true }]);
    setCustom("");
  };
  return (
    <div>
      <Heading title="Any conditions?" sub="Select all that apply. You can change these any time." />
      <div className="flex flex-wrap gap-2 mb-4">
        {CONDITION_OPTIONS.map((c) => {
          const on = labels.has(c);
          return (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-sm transition",
                on ? "bg-primary/15 border-primary text-primary font-medium" : "bg-card hover:bg-muted",
              )}
            >
              {c}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {conditions
          .filter((c) => c.custom)
          .map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm">
              {c.label}
              <button onClick={() => setConditions(conditions.filter((x) => x.id !== c.id))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add another condition…"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
        />
        <Button onClick={addCustom} variant="secondary"><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function Step3({ meds, setMeds }: { meds: Medication[]; setMeds: (m: Medication[]) => void }) {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("08:00");
  const add = () => {
    if (!name.trim()) return;
    setMeds([...meds, { id: uid(), name: name.trim(), dosage: dosage.trim() || "—", time }]);
    setName("");
    setDosage("");
  };
  return (
    <div>
      <Heading title="Current medications" sub="We'll remind you and track adherence." />
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Metformin" />
            </div>
            <div>
              <Label>Dosage</Label>
              <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="500mg" />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <Button onClick={add} className="w-full" variant="secondary"><Plus className="h-4 w-4" /> Add medication</Button>
        </CardContent>
      </Card>
      <div className="mt-4 space-y-2">
        {meds.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-card border">
            <div>
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.dosage} · {m.time}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMeds(meds.filter((x) => x.id !== m.id))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step4({
  metrics,
  setMetrics,
  conditions,
}: {
  metrics: LogMetric[];
  setMetrics: (m: LogMetric[]) => void;
  conditions: string[];
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [freq, setFreq] = useState<LogMetric["frequency"]>("daily");
  const [time, setTime] = useState("09:00");

  return (
    <div>
      <Heading title="Suggested tracking" sub="Based on your conditions. Tweak or approve all." />
      <div className="space-y-2 mb-4">
        {metrics.length === 0 && (
          <p className="text-sm text-muted-foreground">No suggestions yet. Add custom logs below.</p>
        )}
        {metrics.map((m, i) => (
          <div key={m.id} className="bg-card border rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Input
                className="font-medium border-0 px-0 focus-visible:ring-0 shadow-none h-auto"
                value={m.name}
                onChange={(e) => {
                  const next = [...metrics];
                  next[i] = { ...m, name: e.target.value };
                  setMetrics(next);
                }}
              />
              <Button variant="ghost" size="icon" onClick={() => setMetrics(metrics.filter((x) => x.id !== m.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={m.unit} onChange={(e) => {
                const next = [...metrics]; next[i] = { ...m, unit: e.target.value }; setMetrics(next);
              }} placeholder="Unit" />
              <Select value={m.frequency} onValueChange={(v) => {
                const next = [...metrics]; next[i] = { ...m, frequency: v as LogMetric["frequency"] }; setMetrics(next);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <Input type="time" value={m.time} onChange={(e) => {
                const next = [...metrics]; next[i] = { ...m, time: e.target.value }; setMetrics(next);
              }} />
            </div>
          </div>
        ))}
      </div>

      <Card className="mb-3">
        <CardContent className="p-4 space-y-3">
          <div className="text-sm font-medium">Create custom log</div>
          <div className="grid grid-cols-2 gap-2">
            <Input className="col-span-2" placeholder="Metric name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Unit (mg, ml, 1-10)" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <Select value={freq} onValueChange={(v) => setFreq(v as LogMetric["frequency"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="col-span-1"
              variant="secondary"
              onClick={() => {
                if (!name.trim() || !unit.trim()) return;
                setMetrics([
                  ...metrics,
                  { id: uid(), name: name.trim(), unit: unit.trim(), frequency: freq, time, source: "custom" },
                ]);
                setName(""); setUnit("");
              }}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => setMetrics(suggestedMetricsFor(conditions).concat(metrics.filter((m) => m.source === "custom")))}
      >
        Reset to suggested for my conditions
      </Button>
    </div>
  );
}

function Step5({ apiKey, setApiKey }: { apiKey: string; setApiKey: (k: string) => void }) {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  return (
    <div>
      <Heading title="Connect Groq" sub="Powers your chat, AI interview, and summaries." />
      <Label>Groq API Key</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="gsk_…"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Get your API key at{" "}
        <a className="underline text-primary" href="https://console.groq.com" target="_blank" rel="noreferrer">
          console.groq.com
        </a>
        . Stored only on this device.
      </p>
      <div className="mt-4">
        <Button
          variant="ghost"
          onClick={() => {
            writeLS(KEYS.groqKey, "");
            writeLS(KEYS.interview, []);
            writeLS(KEYS.onboarded, true);
            navigate({ to: "/" });
          }}
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function Step6Interview({
  hasKey,
  context,
  onComplete,
}: {
  hasKey: boolean;
  context: { profile: Profile; conditions: Condition[]; meds: Medication[] };
  onComplete: (answers: InterviewAnswer[]) => void;
}) {
  const SECTIONS = ["Diagnosis Timeline", "Symptoms", "Surgeries", "Family History", "Lifestyle"];
  const [completed, setCompleted] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answers = useMemo<InterviewAnswer[]>(() => {
    const out: InterviewAnswer[] = [];
    let lastQ = "";
    let section = SECTIONS[0];
    messages.forEach((m) => {
      if (m.role === "assistant") {
        const tokenMatch = m.content.match(/\[SECTION_DONE:([^\]]+)\]/);
        if (tokenMatch) section = SECTIONS[SECTIONS.indexOf(tokenMatch[1]) + 1] || section;
        lastQ = m.content.replace(/\[SECTION_DONE:[^\]]+\]/g, "").replace(/\[INTERVIEW_DONE\]/g, "").trim();
      } else if (m.role === "user") {
        out.push({ section, question: lastQ, answer: m.content });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const begin = async () => {
    setLoading(true);
    setError(null);
    try {
      const sys = `${INTERVIEW_SYSTEM}\n\nPatient context: ${JSON.stringify(context)}`;
      const reply = await chatCompletion({
        messages: [{ role: "system", content: sys }, { role: "user", content: "Please begin the interview." }],
      });
      handleAssistant(reply, []);
    } catch (e) {
      setError(e instanceof GroqError ? e.message : "Could not reach Groq.");
    } finally {
      setLoading(false);
    }
  };

  const handleAssistant = (text: string, history: ChatMessage[]) => {
    setMessages([...history, { role: "assistant", content: text }]);
    const sectionDone = [...text.matchAll(/\[SECTION_DONE:([^\]]+)\]/g)].map((m) => m[1]);
    if (sectionDone.length) setCompleted((prev) => Array.from(new Set([...prev, ...sectionDone])));
    if (text.includes("[INTERVIEW_DONE]")) setDone(true);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const sys = `${INTERVIEW_SYSTEM}\n\nPatient context: ${JSON.stringify(context)}`;
      const reply = await chatCompletion({
        messages: [{ role: "system", content: sys }, ...next],
      });
      handleAssistant(reply, next);
    } catch (e) {
      setError(e instanceof GroqError ? e.message : "Could not reach Groq.");
    } finally {
      setLoading(false);
    }
  };

  if (!hasKey)
    return (
      <div>
        <Heading title="AI Medical Interview" sub="Skipped — add your Groq key in Settings later to enable this." />
        <Button className="w-full" onClick={() => onComplete([])}>Finish setup</Button>
      </div>
    );

  return (
    <div className="flex flex-col h-[70vh]">
      <Heading title="AI Medical Interview" sub="Answer at your pace — short answers are fine." />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <span key={s} className={cn(
            "text-xs px-2 py-1 rounded-full border",
            completed.includes(s) ? "bg-primary/15 text-primary border-primary/30" : "bg-muted text-muted-foreground",
          )}>
            {completed.includes(s) && <Check className="inline h-3 w-3 mr-0.5" />}
            {s}
          </span>
        ))}
      </div>

      {messages.length === 0 ? (
        <Button onClick={begin} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start interview"}
        </Button>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto space-y-2 p-1">
            {messages.map((m, i) => (
              <div key={i} className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted",
              )}>
                <ReactMarkdown>
                  {m.content.replace(/\[SECTION_DONE:[^\]]+\]/g, "").replace(/\[INTERVIEW_DONE\]/g, "").trim()}
                </ReactMarkdown>
              </div>
            ))}
            {loading && <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</div>}
          </div>
          {error && <p className="text-xs text-destructive py-2">{error}</p>}
          {!done ? (
            <div className="border-t pt-3 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type your answer…"
                disabled={loading}
              />
              <Button onClick={send} disabled={loading || !input.trim()}>Send</Button>
            </div>
          ) : (
            <div className="border-t pt-3">
              <p className="text-sm text-primary mb-2">Interview complete — thank you!</p>
              <Button className="w-full" onClick={() => onComplete(answers)}>Finish setup</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
