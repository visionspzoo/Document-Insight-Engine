import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  useGetJob,
  useDeleteDocument,
  useListJobResults,
  getGetJobQueryKey,
  getListJobResultsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Upload,
  Play,
  FileText,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG = {
  pending: { color: "text-blue-500", bg: "bg-blue-500/10", label: "Pending" },
  processing: { color: "text-amber-500", bg: "bg-amber-500/10", label: "Processing" },
  completed: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Completed" },
  failed: { color: "text-red-500", bg: "bg-red-500/10", label: "Failed" },
};

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const jobId = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: job, isLoading } = useGetJob(jobId, {
    query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId) },
  });

  const { data: results, isLoading: resultsLoading } = useListJobResults(jobId, {
    query: { enabled: !!jobId, queryKey: getListJobResultsQueryKey(jobId) },
  });

  const deleteDocument = useDeleteDocument();

  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    let successCount = 0;
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`/api/jobs/${jobId}/documents`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          successCount++;
        } else {
          const err = await res.json();
          toast({ title: "Upload failed", description: err.error || file.name, variant: "destructive" });
        }
      } catch {
        toast({ title: "Upload error", description: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }
    setUploading(false);
    if (successCount > 0) {
      toast({ title: "Uploaded", description: `${successCount} file(s) uploaded successfully` });
      queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [jobId]);

  const handleProcess = async () => {
    if (!job?.documents?.length) {
      toast({ title: "No documents", description: "Upload documents before processing", variant: "destructive" });
      return;
    }
    setProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    setTotalCount(job.documentCount);

    try {
      const res = await fetch(`/api/jobs/${jobId}/process`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Processing failed", variant: "destructive" });
        setProcessing(false);
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

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
              const data = JSON.parse(line.slice(6));
              if (data.type === "start") {
                setTotalCount(data.total);
              } else if (data.type === "progress") {
                const count = data.processedCount ?? processedCount + 1;
                setProcessedCount(count);
                setProgress(Math.round((count / (data.total || totalCount)) * 100));
              } else if (data.type === "done") {
                setProgress(100);
                toast({
                  title: data.status === "completed" ? "Processing complete" : "Processing done with errors",
                  description: `${data.processedCount} document(s) processed`,
                  variant: data.status === "completed" ? "default" : "destructive",
                });
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch {
      toast({ title: "Error", description: "Processing connection failed", variant: "destructive" });
    } finally {
      setProcessing(false);
      queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
      queryClient.invalidateQueries({ queryKey: getListJobResultsQueryKey(jobId) });
    }
  };

  const handleDeleteDocument = (docId: number) => {
    deleteDocument.mutate({ jobId, docId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
        toast({ title: "Removed", description: "Document removed from job" });
      },
      onError: () => toast({ title: "Error", description: "Failed to remove document", variant: "destructive" }),
    });
  };

  const handleExport = (format: "csv" | "json" | "xml") => {
    window.location.href = `/api/jobs/${jobId}/export?format=${format}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p className="font-medium">Job not found</p>
        <Link href="/jobs">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Jobs
          </Button>
        </Link>
      </div>
    );
  }

  const status = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const canProcess = job.status !== "processing" && (job.documents?.some((d) => d.status === "pending") ?? false);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/jobs">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
            <Badge className={`${status.bg} ${status.color} border-0`}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {job.documentCount} document(s) · Created {new Date(job.createdAt).toLocaleDateString('pl-PL')}
            {job.prompt && <span className="ml-2">· Prompt: <span className="font-medium">{job.prompt.name}</span></span>}
          </p>
        </div>
        <Button onClick={handleProcess} disabled={!canProcess || processing} className="gap-2" data-testid="button-process">
          {processing ? <Activity className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {processing ? "Processing..." : "Process Documents"}
        </Button>
      </div>

      {processing && (
        <Card className="bg-card/80 border-amber-500/30 border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-500 font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 animate-spin" />
                Processing documents with Claude AI...
              </span>
              <span className="font-mono text-muted-foreground">{processedCount}/{totalCount}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents" data-testid="tab-documents">
            Documents <Badge variant="secondary" className="ml-2 text-xs">{job.documentCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">
            Results <Badge variant="secondary" className="ml-2 text-xs">{results?.length ?? 0}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4 mt-4">
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-upload"
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium text-foreground">Drop files here or click to upload</p>
            <p className="text-sm text-muted-foreground mt-1">PDF, PNG, JPG, TIFF, TXT — up to 50MB each</p>
            {uploading && <p className="text-sm text-primary mt-2 animate-pulse">Uploading...</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.txt"
            className="hidden"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            data-testid="input-file-upload"
          />

          {job.documents && job.documents.length > 0 ? (
            <div className="space-y-2">
              {job.documents.map((doc) => {
                const docStatus = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                return (
                  <Card key={doc.id} className="bg-card/50 border-border/50" data-testid={`card-document-${doc.id}`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground">{(doc.sizeBytes / 1024).toFixed(1)} KB · {doc.mimeType}</p>
                      </div>
                      <Badge className={`${docStatus.bg} ${docStatus.color} border-0 text-xs flex-shrink-0`}>{docStatus.label}</Badge>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive flex-shrink-0" onClick={() => handleDeleteDocument(doc.id)} data-testid={`button-delete-doc-${doc.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No documents uploaded yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4 mt-4">
          {results && results.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{results.length} result(s)</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Export:</span>
                <Button variant="outline" size="sm" onClick={() => handleExport("csv")} data-testid="button-export-csv">CSV</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} data-testid="button-export-json">JSON</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("xml")} data-testid="button-export-xml">XML</Button>
              </div>
            </div>
          )}

          {resultsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <CardContent className="p-4">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : results && results.length > 0 ? (
            <div className="space-y-3">
              {results.map((result) => (
                <Card key={result.id} className="bg-card/50 border-border/50" data-testid={`card-result-${result.id}`}>
                  <CardHeader className="p-4 pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span className="font-medium text-sm">{result.documentFilename ?? "Unknown document"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
                        data-testid={`button-expand-result-${result.id}`}
                      >
                        {expandedResult === result.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {expandedResult === result.id ? "Collapse" : "Expand"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {result.extractedData && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Extracted Data</p>
                        <ScrollArea className={expandedResult === result.id ? "h-64" : "h-24"}>
                          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap bg-background/50 border border-border/50 rounded-md p-3">
                            {result.extractedData}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}
                    {result.analysisResult && expandedResult === result.id && (
                      <div className="space-y-2 mt-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Analysis</p>
                        <ScrollArea className="h-48">
                          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap bg-background/50 border border-border/50 rounded-md p-3">
                            {result.analysisResult}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">No results yet</p>
              <p className="text-sm mt-1">Upload documents and click "Process" to start extraction.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
