import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/admin-api";
import {
  ArrowLeft, ArrowRight, Check, Upload, FileText, Trash2,
  RotateCcw, Activity, CheckCircle2, AlertCircle, Sparkles,
} from "lucide-react";

type StepId = 1 | 2 | 3 | 4 | 5;

interface PromptRow {
  id: number;
  name: string;
  extractionPrompt: string;
  analysisPrompt: string | null;
  isTemplate: boolean;
}

interface JobDoc {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: "pending" | "processing" | "completed" | "failed";
}

interface JobResult {
  id: number;
  documentId: number;
  documentFilename: string | null;
  extractedData: string | null;
  analysisResult: string | null;
}

interface JobDetail {
  id: number;
  name: string;
  status: string;
  documents: JobDoc[];
  results: JobResult[];
  promptId: number | null;
}

const STEP_LABELS: Record<StepId, string> = {
  1: "Prompt ekstrakcji",
  2: "Dokumenty",
  3: "Wyekstraktowane dane",
  4: "Prompt analizy",
  5: "Wyniki analizy",
};

export default function WizardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<StepId>(1);

  const [projectName, setProjectName] = useState("");
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [jobId, setJobId] = useState<number | null>(null);
  const [promptId, setPromptId] = useState<number | null>(null);

  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const templatesQ = useQuery<PromptRow[]>({
    queryKey: ["prompts", "templates"],
    queryFn: () => apiFetch<PromptRow[]>("/api/prompts"),
  });

  function handleTemplateChange(value: string) {
    setSelectedTemplateId(value);
    if (value !== "none") {
      const t = templatesQ.data?.find((p) => String(p.id) === value);
      if (t) {
        setProjectName((n) => n || t.name);
        setExtractionPrompt(t.extractionPrompt);
        if (t.analysisPrompt) setAnalysisPrompt(t.analysisPrompt);
      }
    }
  }

  async function handleStep1Next() {
    if (!projectName.trim() || !extractionPrompt.trim()) {
      toast({ title: "Uzupełnij dane", description: "Nazwa projektu i prompt są wymagane.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const prompt = await apiFetch<{ id: number }>("/api/prompts", {
        method: "POST",
        body: JSON.stringify({
          name: projectName,
          extractionPrompt,
          analysisPrompt: null,
          isTemplate: saveAsTemplate,
        }),
      });
      setPromptId(prompt.id);
      const job = await apiFetch<{ id: number }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ name: projectName, promptId: prompt.id }),
      });
      setJobId(job.id);
      setStep(2);
    } catch (e: unknown) {
      toast({ title: "Błąd", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Kreator nowego projektu</h1>
        <p className="text-sm text-muted-foreground">Krok {step} z 5 — {STEP_LABELS[step]}</p>
      </div>

      <StepperBar current={step} />

      {step === 1 && (
        <Step1
          projectName={projectName}
          setProjectName={setProjectName}
          extractionPrompt={extractionPrompt}
          setExtractionPrompt={setExtractionPrompt}
          saveAsTemplate={saveAsTemplate}
          setSaveAsTemplate={setSaveAsTemplate}
          templates={templatesQ.data ?? []}
          selectedTemplateId={selectedTemplateId}
          onTemplateChange={handleTemplateChange}
          onNext={handleStep1Next}
          busy={busy}
        />
      )}

      {step === 2 && jobId && (
        <Step2
          jobId={jobId}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && jobId && (
        <Step3
          jobId={jobId}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          onFinish={() => setLocation(`/jobs/${jobId}`)}
        />
      )}

      {step === 4 && jobId && (
        <Step4
          jobId={jobId}
          analysisPrompt={analysisPrompt}
          setAnalysisPrompt={setAnalysisPrompt}
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
        />
      )}

      {step === 5 && jobId && (
        <Step5
          jobId={jobId}
          onFinish={() => setLocation(`/jobs/${jobId}`)}
        />
      )}
    </div>
  );
}

function StepperBar({ current }: { current: StepId }) {
  const steps: StepId[] = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const isActive = s === current;
        const isDone = s < current;
        return (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                isDone ? "bg-primary text-primary-foreground" :
                isActive ? "bg-primary/20 text-primary border-2 border-primary" :
                "bg-muted text-muted-foreground"
              }`}
              data-testid={`stepper-${s}`}
            >
              {isDone ? <Check className="h-4 w-4" /> : s}
            </div>
            <div className="text-xs text-muted-foreground hidden md:block flex-1 truncate">{STEP_LABELS[s]}</div>
            {i < steps.length - 1 && <div className={`h-0.5 flex-1 ${isDone ? "bg-primary" : "bg-muted"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Step1({
  projectName, setProjectName, extractionPrompt, setExtractionPrompt,
  saveAsTemplate, setSaveAsTemplate, templates, selectedTemplateId, onTemplateChange,
  onNext, busy,
}: {
  projectName: string; setProjectName: (v: string) => void;
  extractionPrompt: string; setExtractionPrompt: (v: string) => void;
  saveAsTemplate: boolean; setSaveAsTemplate: (v: boolean) => void;
  templates: PromptRow[]; selectedTemplateId: string; onTemplateChange: (v: string) => void;
  onNext: () => void; busy: boolean;
}) {
  const templateOptions = templates.filter((t) => t.isTemplate);
  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <p className="text-sm text-muted-foreground">
          Zdefiniuj jakie informacje mają zostać wyekstraktowane z dokumentów. Możesz zapisać prompt jako szablon, aby użyć go ponownie.
        </p>

        {templateOptions.length > 0 && (
          <div className="space-y-2">
            <Label>Wczytaj z szablonu (opcjonalnie)</Label>
            <Select value={selectedTemplateId} onValueChange={onTemplateChange}>
              <SelectTrigger data-testid="select-template"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Brak — wprowadzę ręcznie</SelectItem>
                {templateOptions.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="project-name">Nazwa projektu</Label>
          <Input
            id="project-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="np. Faktury Q1 2026"
            data-testid="input-project-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="extraction-prompt">Prompt ekstrakcji</Label>
          <Textarea
            id="extraction-prompt"
            rows={8}
            value={extractionPrompt}
            onChange={(e) => setExtractionPrompt(e.target.value)}
            placeholder="Opisz szczegółowo jakie dane mają zostać wyekstraktowane z każdego dokumentu, np.: numer faktury, data wystawienia, nazwa kontrahenta, NIP, suma netto, suma brutto, pozycje…"
            data-testid="input-extraction-prompt"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={saveAsTemplate}
            onCheckedChange={(v) => setSaveAsTemplate(v === true)}
            data-testid="checkbox-save-template"
          />
          <span className="text-sm">Zapisz jako szablon do ponownego wykorzystania</span>
        </label>

        <div className="flex justify-end pt-2">
          <Button onClick={onNext} disabled={busy} data-testid="button-step1-next">
            {busy ? "Tworzenie…" : "Dalej"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function useJobDetail(jobId: number, refetchInterval?: number) {
  return useQuery<JobDetail>({
    queryKey: ["jobs", jobId],
    queryFn: () => apiFetch<JobDetail>(`/api/jobs/${jobId}`),
    refetchInterval,
  });
}

async function consumeSse(
  res: Response,
  onEvent: (data: { type: string; total?: number; processedCount?: number; failedCount?: number; status?: string }) => void,
) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch { /* ignore */ }
      }
    }
  }
}

function Step2({ jobId, onBack, onNext }: { jobId: number; onBack: () => void; onNext: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [done, setDone] = useState(false);

  const job = useJobDetail(jobId, processing ? 1500 : undefined);

  async function handleUpload(files: FileList) {
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/jobs/${jobId}/documents`, { method: "POST", body: fd });
      if (r.ok) ok++;
      else toast({ title: "Błąd", description: file.name, variant: "destructive" });
    }
    setUploading(false);
    if (ok > 0) {
      toast({ title: "Przesłano", description: `${ok} plik(i)` });
      job.refetch();
    }
  }

  async function handleDelete(docId: number) {
    await fetch(`/api/jobs/${jobId}/documents/${docId}`, { method: "DELETE" });
    job.refetch();
  }

  async function handleProcess() {
    if (!job.data?.documents.length) {
      toast({ title: "Brak dokumentów", variant: "destructive" });
      return;
    }
    setProcessing(true); setProgress(0); setProcessedCount(0); setDone(false);
    setTotalCount(job.data.documents.filter((d) => d.status === "pending").length);
    try {
      const res = await fetch(`/api/jobs/${jobId}/process`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Błąd", description: err.error, variant: "destructive" });
        setProcessing(false);
        return;
      }
      await consumeSse(res, (data) => {
        if (data.type === "start") setTotalCount(data.total ?? 0);
        else if (data.type === "progress" && data.processedCount !== undefined) {
          setProcessedCount(data.processedCount);
          setProgress(Math.round((data.processedCount / Math.max(1, data.total ?? totalCount)) * 100));
        } else if (data.type === "done") {
          setProgress(100);
          setDone(true);
          toast({ title: "Ekstrakcja zakończona", description: `${data.processedCount} dokument(y)` });
        }
      });
    } finally {
      setProcessing(false);
      job.refetch();
    }
  }

  const docs = job.data?.documents ?? [];
  const allDone = docs.length > 0 && docs.every((d) => d.status === "completed" || d.status === "failed");

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Prześlij pliki PDF, obrazy lub teksty (do 50 MB). Po przesłaniu uruchom ekstrakcję — postęp pojawi się na żywo.
        </p>

        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          data-testid="dropzone-upload"
        >
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-medium">Upuść pliki tutaj lub kliknij, aby przesłać</p>
          <p className="text-sm text-muted-foreground mt-1">PDF, PNG, JPG, TIFF, TXT — do 50 MB</p>
          {uploading && <p className="text-sm text-primary mt-2 animate-pulse">Przesyłanie…</p>}
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.txt"
          className="hidden"
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          data-testid="input-file"
        />

        {processing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-amber-500 flex items-center gap-2">
                <Activity className="h-4 w-4 animate-spin" /> Ekstrakcja w toku…
              </span>
              <span className="font-mono text-muted-foreground">{processedCount}/{totalCount}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {docs.length > 0 && (
          <div className="space-y-2">
            {docs.map((d) => <DocRow key={d.id} doc={d} onDelete={() => handleDelete(d.id)} />)}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Wstecz</Button>
          <div className="flex gap-2">
            {!allDone && !done && (
              <Button onClick={handleProcess} disabled={processing || docs.length === 0} data-testid="button-process">
                {processing ? <Activity className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Uruchom ekstrakcję
              </Button>
            )}
            <Button onClick={onNext} disabled={!allDone} data-testid="button-step2-next">
              Dalej<ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DocRow({ doc, onDelete, onRetry }: { doc: JobDoc; onDelete?: () => void; onRetry?: () => void }) {
  const cfg = {
    pending: { color: "text-blue-500", bg: "bg-blue-500/10", label: "Oczekuje" },
    processing: { color: "text-amber-500", bg: "bg-amber-500/10", label: "Przetwarzanie" },
    completed: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Ukończone" },
    failed: { color: "text-red-500", bg: "bg-red-500/10", label: "Błąd" },
  }[doc.status];
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/50 bg-card/50 p-3" data-testid={`row-doc-${doc.id}`}>
      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.filename}</p>
        <p className="text-xs text-muted-foreground">{(doc.sizeBytes / 1024).toFixed(1)} KB · {doc.mimeType}</p>
      </div>
      <Badge className={`${cfg.bg} ${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>
      {onRetry && (
        <Button size="icon" variant="ghost" onClick={onRetry} title="Ponów ekstrakcję" data-testid={`button-retry-${doc.id}`}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
      {onDelete && (
        <Button size="icon" variant="ghost" className="text-destructive" onClick={onDelete} data-testid={`button-delete-${doc.id}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function Step3({ jobId, onBack, onNext, onFinish }: {
  jobId: number; onBack: () => void; onNext: () => void; onFinish: () => void;
}) {
  const { toast } = useToast();
  const [retrying, setRetrying] = useState(false);
  const [progress, setProgress] = useState(0);
  const job = useJobDetail(jobId, retrying ? 1500 : undefined);

  async function retryDoc(docId: number) {
    setRetrying(true); setProgress(0);
    try {
      await apiFetch(`/api/jobs/${jobId}/documents/${docId}/reset`, { method: "POST" });
      const res = await fetch(`/api/jobs/${jobId}/process`, { method: "POST" });
      if (!res.ok) {
        toast({ title: "Błąd", variant: "destructive" });
        return;
      }
      await consumeSse(res, (data) => {
        if (data.type === "progress" && data.processedCount !== undefined && data.total) {
          setProgress(Math.round((data.processedCount / data.total) * 100));
        } else if (data.type === "done") {
          setProgress(100);
          toast({ title: "Ponowiono", description: `Dokument przetworzony` });
        }
      });
    } finally {
      setRetrying(false);
      job.refetch();
    }
  }

  const results = job.data?.results ?? [];
  const docsById = new Map((job.data?.documents ?? []).map((d) => [d.id, d]));

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Sprawdź wyekstraktowane dane. W razie potrzeby możesz ponowić proces dla wybranego dokumentu lub zakończyć projekt na tym etapie.
        </p>

        {retrying && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-amber-500 flex items-center gap-2"><Activity className="h-4 w-4 animate-spin" /> Ponawianie…</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Brak wyników ekstrakcji.</p>
          </div>
        )}

        <div className="space-y-3">
          {results.map((r) => {
            const doc = docsById.get(r.documentId);
            return (
              <Card key={r.id} className="bg-card/50 border-border/50" data-testid={`card-extract-${r.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="font-medium text-sm">{r.documentFilename ?? doc?.filename ?? "—"}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => retryDoc(r.documentId)} disabled={retrying} data-testid={`button-retry-result-${r.id}`}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Ponów
                    </Button>
                  </div>
                  <ScrollArea className="h-32">
                    <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap bg-background/50 border border-border/50 rounded-md p-3">
                      {r.extractedData ?? "(brak danych)"}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Wstecz</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onFinish} data-testid="button-skip-analysis">Pomiń analizę i zakończ</Button>
            <Button onClick={onNext} disabled={results.length === 0} data-testid="button-step3-next">
              Przejdź do analizy<ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Step4({ jobId, analysisPrompt, setAnalysisPrompt, onBack, onNext }: {
  jobId: number; analysisPrompt: string; setAnalysisPrompt: (v: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  async function run() {
    if (!analysisPrompt.trim()) {
      toast({ title: "Wprowadź prompt analizy", variant: "destructive" });
      return;
    }
    setRunning(true); setProgress(0); setProcessedCount(0);
    try {
      const res = await fetch(`/api/jobs/${jobId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisPrompt }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Błąd", description: err.error, variant: "destructive" });
        return;
      }
      await consumeSse(res, (data) => {
        if (data.type === "start") setTotalCount(data.total ?? 0);
        else if (data.type === "progress" && data.processedCount !== undefined) {
          setProcessedCount(data.processedCount);
          setProgress(Math.round((data.processedCount / Math.max(1, data.total ?? totalCount)) * 100));
        } else if (data.type === "done") {
          setProgress(100);
          toast({ title: "Analiza zakończona" });
          onNext();
        }
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Opisz, jak AI ma przeanalizować zebrane dane — np. podsumowanie, zestawienia, anomalie, porównania.
        </p>
        <div className="space-y-2">
          <Label htmlFor="analysis-prompt">Prompt analizy</Label>
          <Textarea
            id="analysis-prompt"
            rows={8}
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            placeholder="np. Przygotuj zbiorcze zestawienie wszystkich faktur z podziałem na kontrahentów, wskaż największych dostawców i wykryj nietypowe kwoty…"
            data-testid="input-analysis-prompt"
          />
        </div>

        {running && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-amber-500 flex items-center gap-2"><Activity className="h-4 w-4 animate-spin" />Analiza w toku…</span>
              <span className="font-mono text-muted-foreground">{processedCount}/{totalCount}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack} disabled={running}><ArrowLeft className="h-4 w-4 mr-2" />Wstecz</Button>
          <Button onClick={run} disabled={running} data-testid="button-run-analysis">
            {running ? <Activity className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Uruchom analizę
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Step5({ jobId, onFinish }: { jobId: number; onFinish: () => void }) {
  const job = useJobDetail(jobId);
  const results = job.data?.results ?? [];

  useEffect(() => {
    const t = setTimeout(() => onFinish(), 4000);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="font-semibold">Analiza zakończona</p>
            <p className="text-sm text-muted-foreground">Za chwilę nastąpi przekierowanie do widoku projektu.</p>
          </div>
        </div>

        <div className="space-y-3">
          {results.map((r) => (
            <Card key={r.id} className="bg-card/50 border-border/50" data-testid={`card-analysis-${r.id}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{r.documentFilename ?? "—"}</span>
                </div>
                {r.analysisResult ? (
                  <ScrollArea className="h-40">
                    <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap bg-background/50 border border-border/50 rounded-md p-3">
                      {r.analysisResult}
                    </pre>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Brak wyniku analizy.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onFinish} data-testid="button-go-to-job">
            Przejdź do projektu<ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
