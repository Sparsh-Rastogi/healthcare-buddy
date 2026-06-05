import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-x/EmptyState";
import { ConfirmDialog } from "@/components/ui-x/ConfirmDialog";
import { useLocalState, KEYS, uid } from "@/lib/storage";
import { fmtDate, todayISO } from "@/lib/format";
import type { ReportFile } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Upload Reports — Healthcare Buddy" },
      { name: "description", content: "Store your lab reports, prescriptions and medical PDFs." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [files, setFiles] = useLocalState<ReportFile[]>(KEYS.reports, []);
  const [drag, setDrag] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const next: ReportFile[] = Array.from(list).map((f) => ({
      id: uid(),
      name: f.name,
      date: todayISO(),
      type: f.name.toLowerCase().includes("prescription") ? "prescription" : f.type.includes("image") ? "other" : "lab",
      size: f.size,
    }));
    setFiles((prev) => [...next, ...prev]);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Medical Reports</h1>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors",
          drag ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/30",
        )}
      >
        <Upload className="h-7 w-7 mx-auto text-primary mb-2" />
        <p className="font-medium">Drop PDF or images here</p>
        <p className="text-sm text-muted-foreground">or tap to browse</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length === 0 ? (
        <EmptyState title="No reports yet" description="Your uploaded reports will be listed here." icon={<FileText className="h-5 w-5" />} />
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(f.date)} · {Math.round(f.size / 1024)} KB
                    </div>
                  </div>
                </div>
                <Select
                  value={f.type}
                  onValueChange={(v) =>
                    setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, type: v as ReportFile["type"] } : x)))
                  }
                >
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lab">Lab Report</SelectItem>
                    <SelectItem value="prescription">Prescription</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => setConfirmId(f.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Delete this report?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmId) setFiles((prev) => prev.filter((x) => x.id !== confirmId));
          setConfirmId(null);
        }}
      />
    </div>
  );
}
