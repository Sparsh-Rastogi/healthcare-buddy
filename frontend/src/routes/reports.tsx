import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload, FileText, Trash2, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-x/EmptyState";
import { ConfirmDialog } from "@/components/ui-x/ConfirmDialog";
import { useLocalState, KEYS, uid } from "@/lib/storage";
import { fmtDate, todayISO } from "@/lib/format";
import type { ReportFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { reportsApi, type ReportRecord } from "@/lib/baymax-api";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: `Upload Reports — ${APP_NAME}` },
      { name: "description", content: "Store your lab reports, prescriptions and medical PDFs." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  // localStorage fallback list (keeps working offline)
  const [localFiles, setLocalFiles] = useLocalState<ReportFile[]>(KEYS.reports, []);
  const [backendReports, setBackendReports] = useState<ReportRecord[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load backend report list on mount
  useEffect(() => {
    reportsApi.list()
      .then(({ reports }) => setBackendReports(reports))
      .catch(() => setBackendReports(null)); // stay in offline mode
  }, []);

  const handleFiles = async (list: FileList | null) => {
    if (!list || uploading) return;
    setUploading(true);
    for (const file of Array.from(list)) {
      try {
        // Try backend upload first (Drive + OCR)
        const record = await reportsApi.upload(file);
        setBackendReports((prev) => (prev ? [record, ...prev] : [record]));
        toast.success(`${file.name} uploaded & queued for analysis`);
      } catch {
        // Fallback: just store metadata locally
        const meta: ReportFile = {
          id: uid(),
          name: file.name,
          date: todayISO(),
          type: file.name.toLowerCase().includes("prescription") ? "prescription"
            : file.type.includes("image") ? "other" : "lab",
          size: file.size,
        };
        setLocalFiles((prev) => [meta, ...prev]);
        toast.warning(`${file.name} saved locally (backend unreachable — no OCR)`);
      }
    }
    setUploading(false);
  };

  // Merge: backend records take precedence; local-only files show as fallback
  const backendIds = new Set((backendReports ?? []).map((r) => r.filename));
  const offlineOnly = localFiles.filter((f) => !backendIds.has(f.name));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Medical Reports</h1>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors",
          drag ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/30",
          uploading && "opacity-60 cursor-wait",
        )}
      >
        {uploading
          ? <><Loader2 className="h-7 w-7 mx-auto text-primary mb-2 animate-spin" /><p className="font-medium">Uploading to Drive…</p></>
          : <><Upload className="h-7 w-7 mx-auto text-primary mb-2" /><p className="font-medium">Drop PDF or images here</p><p className="text-sm text-muted-foreground">or tap to browse — files go to Google Drive & get auto-parsed</p></>
        }
        <input ref={inputRef} type="file" multiple accept=".pdf,image/*" className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {/* Backend reports */}
      {backendReports !== null && backendReports.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Synced to Drive</p>
          {backendReports.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.filename}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(r.uploaded_at.slice(0, 10))}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.parsed
                    ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Parsed</span>
                    : r.parse_error
                      ? <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" />Error</span>
                      : <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Pending</span>
                  }
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Offline-only fallback files */}
      {offlineOnly.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saved locally (offline)</p>
          {offlineOnly.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(f.date)} · {Math.round(f.size / 1024)} KB · local only</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setConfirmId(f.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {backendReports !== null && backendReports.length === 0 && offlineOnly.length === 0 && (
        <EmptyState title="No reports yet" description="Upload a PDF or image — Baymax will extract your lab values automatically." icon={<FileText className="h-5 w-5" />} />
      )}
      {backendReports === null && localFiles.length === 0 && (
        <EmptyState title="No reports yet" description="Your uploaded reports will be listed here." icon={<FileText className="h-5 w-5" />} />
      )}

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Delete this report?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmId) setLocalFiles((prev) => prev.filter((x) => x.id !== confirmId));
          setConfirmId(null);
        }}
      />
    </div>
  );
}
