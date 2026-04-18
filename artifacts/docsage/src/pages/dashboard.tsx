import {
  useGetDashboardStats,
  useGetRecentJobs,
  useListPrompts,
  useCreateJob,
  getGetDashboardStatsQueryKey,
  getGetRecentJobsQueryKey,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Briefcase, CheckCircle2, Clock, Terminal, Activity, ArrowRight, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  pending: "Oczekuje",
  processing: "Przetwarzanie",
  completed: "Ukończone",
  failed: "Błąd",
};

export default function Dashboard() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });

  const { data: recentJobs, isLoading: jobsLoading } = useGetRecentJobs({
    query: { queryKey: getGetRecentJobsQueryKey() },
  });

  const { data: prompts } = useListPrompts();

  const createJob = useCreateJob();
  const [newJobName, setNewJobName] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState("");

  const handleCreateJob = () => {
    if (!newJobName) {
      toast({ title: "Błąd", description: "Nazwa zadania jest wymagana", variant: "destructive" });
      return;
    }
    createJob.mutate(
      {
        data: {
          name: newJobName,
          promptId: selectedPrompt && selectedPrompt !== "none" ? parseInt(selectedPrompt, 10) : null,
        },
      },
      {
        onSuccess: (data) => {
          toast({ title: "Sukces", description: "Zadanie zostało utworzone" });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentJobsQueryKey() });
          setLocation(`/jobs/${data.id}`);
        },
        onError: () => {
          toast({ title: "Błąd", description: "Nie udało się utworzyć zadania", variant: "destructive" });
        },
      }
    );
  };

  const statCards = [
    { label: "Zadania razem", value: stats?.totalJobs, icon: Briefcase, color: "text-blue-500" },
    { label: "W trakcie", value: stats?.processingJobs, icon: Activity, color: "text-amber-500" },
    { label: "Ukończone", value: stats?.completedJobs, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Dokumenty", value: stats?.totalDocuments, icon: FileText, color: "text-primary" },
    { label: "Ekstrakcje", value: stats?.totalResults, icon: Terminal, color: "text-purple-500" },
    { label: "Szablony", value: stats?.savedPrompts, icon: Clock, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Pulpit</h1>
        <p className="text-muted-foreground">Monitoruj status przetwarzania i ostatnie zadania ekstrakcji.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statsLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <CardContent className="p-6">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))
          : statCards.map((stat, i) => (
              <Card
                key={i}
                className="bg-card/50 border-border/50 transition-all hover:bg-card hover:border-border"
              >
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold tracking-tight font-mono">{stat.value ?? 0}</p>
                  </div>
                  <div
                    className={`p-3 rounded-full bg-background border border-border ${stat.color}`}
                  >
                    <stat.icon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Ostatnie zadania</h2>
            <Link href="/jobs" className="text-sm text-primary hover:underline flex items-center gap-1">
              Pokaż wszystkie <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="bg-card border-border overflow-hidden">
            {jobsLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recentJobs && recentJobs.length > 0 ? (
              <div className="divide-y divide-border">
                {recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <h3 className="font-medium text-foreground">{job.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{job.documentCount} dok.</span>
                        <span className="font-mono text-xs">
                          {new Date(job.createdAt).toLocaleDateString("pl-PL")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            job.status === "completed"
                              ? "bg-emerald-500"
                              : job.status === "processing"
                              ? "bg-amber-500 animate-pulse"
                              : job.status === "failed"
                              ? "bg-red-500"
                              : "bg-blue-500"
                          }`}
                        />
                        <span className="text-sm font-medium">
                          {STATUS_LABELS[job.status] ?? job.status}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <Briefcase className="h-12 w-12 mb-4 opacity-20" />
                <p>Brak zadań.</p>
                <p className="text-sm">Utwórz nowe zadanie, aby rozpocząć analizę dokumentów.</p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Szybka akcja</h2>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Utwórz zadanie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="job-name">Nazwa zadania</Label>
                <Input
                  id="job-name"
                  placeholder="np. Faktury Q3"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  className="font-mono text-sm"
                  data-testid="input-job-name"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateJob()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt">Szablon ekstrakcji (opcjonalnie)</Label>
                <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                  <SelectTrigger className="font-mono text-sm">
                    <SelectValue placeholder="Wybierz szablon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak (analiza domyślna)</SelectItem>
                    {prompts?.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateJob}
                disabled={createJob.isPending}
                className="w-full gap-2"
                data-testid="button-create-job"
              >
                {createJob.isPending ? (
                  <Activity className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Utwórz i dodaj dokumenty
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
