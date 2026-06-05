import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui-x/ConfirmDialog";
import { useLocalState, KEYS, uid, clearAllHB } from "@/lib/storage";
import type {
  Condition,
  EmergencyContact,
  LogMetric,
  Medication,
  Profile,
} from "@/lib/types";
import { CONDITION_OPTIONS } from "@/lib/suggestedLogs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Healthcare Buddy" },
      { name: "description", content: "Update your profile, meds, logs, and API key." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-5 pb-16">
      <h1 className="text-xl font-semibold">Settings</h1>
      <ProfileSection />
      <ConditionsSection />
      <MedsSection />
      <MetricsSection />
      <ApiKeySection />
      <EmergencySection />
      <DangerSection />
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function ProfileSection() {
  const [profile, setProfile] = useLocalState<Profile | null>(KEYS.profile, null);
  if (!profile) return null;
  return (
    <SectionCard title="Profile">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Name</Label>
          <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </div>
        <div>
          <Label>Age</Label>
          <Input
            type="number"
            value={profile.age}
            onChange={(e) => setProfile({ ...profile, age: e.target.value ? Number(e.target.value) : "" })}
          />
        </div>
        <div>
          <Label>City</Label>
          <Input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
        </div>
        <div className="col-span-2">
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
    </SectionCard>
  );
}

function ConditionsSection() {
  const [conditions, setConditions] = useLocalState<Condition[]>(KEYS.conditions, []);
  const [custom, setCustom] = useState("");
  const labels = new Set(conditions.map((c) => c.label));
  return (
    <SectionCard title="Conditions">
      <div className="flex flex-wrap gap-2">
        {CONDITION_OPTIONS.map((c) => {
          const on = labels.has(c);
          return (
            <button
              key={c}
              onClick={() => on ? setConditions(conditions.filter((x) => x.label !== c)) : setConditions([...conditions, { id: uid(), label: c }])}
              className={cn("px-3 py-1.5 rounded-full border text-sm", on ? "bg-primary/15 border-primary text-primary font-medium" : "bg-card hover:bg-muted")}
            >
              {c}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add custom condition" />
        <Button
          variant="secondary"
          onClick={() => {
            if (!custom.trim()) return;
            setConditions([...conditions, { id: uid(), label: custom.trim(), custom: true }]);
            setCustom("");
          }}
        ><Plus className="h-4 w-4" /></Button>
      </div>
    </SectionCard>
  );
}

function MedsSection() {
  const [meds, setMeds] = useLocalState<Medication[]>(KEYS.meds, []);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("08:00");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  return (
    <SectionCard title="Medications">
      <div className="grid grid-cols-3 gap-2">
        <Input className="col-span-3" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} />
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <Button onClick={() => {
          if (!name.trim()) return;
          setMeds([...meds, { id: uid(), name: name.trim(), dosage: dosage.trim() || "—", time }]);
          setName(""); setDosage("");
        }}>Add</Button>
      </div>
      <div className="space-y-2">
        {meds.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border bg-card">
            <div>
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.dosage} · {m.time}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setPendingDelete(m.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Remove medication?"
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingDelete) setMeds(meds.filter((m) => m.id !== pendingDelete));
          setPendingDelete(null);
        }}
      />
    </SectionCard>
  );
}

function MetricsSection() {
  const [metrics, setMetrics] = useLocalState<LogMetric[]>(KEYS.metrics, []);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [freq, setFreq] = useState<LogMetric["frequency"]>("daily");
  const [time, setTime] = useState("09:00");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  return (
    <SectionCard title="Tracking Metrics">
      <div className="grid grid-cols-2 gap-2">
        <Input className="col-span-2" placeholder="Metric name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <Select value={freq} onValueChange={(v) => setFreq(v as LogMetric["frequency"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => {
          if (!name.trim() || !unit.trim()) return;
          setMetrics([...metrics, { id: uid(), name: name.trim(), unit: unit.trim(), frequency: freq, time, source: "custom" }]);
          setName(""); setUnit("");
        }}>Add</Button>
      </div>
      <div className="space-y-2">
        {metrics.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border bg-card">
            <div>
              <div className="font-medium">{m.name} <span className="text-xs text-muted-foreground">({m.source})</span></div>
              <div className="text-xs text-muted-foreground">{m.frequency} · {m.time} · {m.unit}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setPendingDelete(m.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete metric?"
        description="Existing logs for this metric will remain in storage but won't show on Home."
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) setMetrics(metrics.filter((m) => m.id !== pendingDelete));
          setPendingDelete(null);
        }}
      />
    </SectionCard>
  );
}

function ApiKeySection() {
  const [apiKey, setApiKey] = useLocalState<string>(KEYS.groqKey, "");
  const [show, setShow] = useState(false);
  return (
    <SectionCard title="Groq API Key">
      <div className="relative">
        <Input type={show ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="gsk_…" />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Get one at <a className="underline text-primary" target="_blank" rel="noreferrer" href="https://console.groq.com">console.groq.com</a>.
      </p>
    </SectionCard>
  );
}

function EmergencySection() {
  const [contact, setContact] = useLocalState<EmergencyContact>(KEYS.emergency, { name: "", phone: "", relationship: "" });
  return (
    <SectionCard title="Emergency Contact">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label>Name</Label>
          <Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
        </div>
        <div>
          <Label>Relationship</Label>
          <Input value={contact.relationship} onChange={(e) => setContact({ ...contact, relationship: e.target.value })} />
        </div>
      </div>
    </SectionCard>
  );
}

function DangerSection() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-2"><CardTitle className="text-base text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Danger zone</CardTitle></CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>Reset all data</Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Wipe all Healthcare Buddy data?"
          description="Profile, conditions, meds, logs, periods, and reports will be permanently deleted from this device."
          confirmLabel="Yes, delete everything"
          onConfirm={() => {
            clearAllHB();
            toast.success("All data cleared");
            navigate({ to: "/onboarding" });
          }}
        />
      </CardContent>
    </Card>
  );
}
