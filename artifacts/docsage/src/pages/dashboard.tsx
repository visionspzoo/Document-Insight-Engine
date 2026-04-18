import { 
  useGetDashboardStats, 
  useGetRecentJobs,
  useListPrompts,
  useCreateJob,
  getGetDashboardStatsQueryKey,
  getGetRecentJobsQueryKey
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Briefcase, CheckCircle2, Clock, Terminal, Activity, ArrowRight, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });
  
  const { data: recentJobs, isLoading: jobsLoading } = useGetRecentJobs({
    query: { queryKey: getGetRecentJobsQueryKey() }
  });

  const { data: prompts, isLoading: promptsLoading } = useListPrompts();
  
  const createJob = useCreateJob();
  const [newJobName, setNewJobName] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState("");

  const handleCreateJob = () => {
    if (!newJobName) {
      toast({ title: "Error", description: "Job name is required", variant: "destructive" });
      return;
    }
    
    createJob.mutate({
      data: {
        name: newJobName,
        promptId: selectedPrompt ? parseInt(selectedPrompt, 10) : undefined
      }
    }, {
      onSuccess: (data) => {
        toast({ title: "Success", description: "Job created successfully" });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentJobsQueryKey() });
        setLocation(`/jobs/${data.id}`);
      },
      onError: (err) => {
        toast({ title: "Error", description: "Failed to create job", variant: "destructive" });
      }
    });
  };

  const statCards = [
    { label: "Total Jobs", value: stats?.totalJobs, icon: Briefcase, color: "text-blue-500" },
    { label: "Processing", value: stats?.processingJobs, icon: Activity, color: "text-amber-500" },
    { label: "Completed", value: stats?.completedJobs, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Documents", value: stats?.totalDocuments, icon: FileText, color: "text-primary" },
    { label: "Extractions", value: stats?.totalResults, icon: Terminal, color: "text-purple-500" },
    { label: "Prompts", value: stats?.savedPrompts, icon: Clock, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Monitor processing status and recent extraction jobs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card/50 border-border/50">
              <CardContent className="p-6">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((stat, i) => (
            <Card key={i} className="bg-card/50 border-border/50 transition-all hover:bg-card hover:border-border">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold tracking-tight font-mono">{stat.value || 0}</p>
                </div>
                <div className={`p-3 rounded-full bg-background border border-border ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Recent Jobs</h2>
            <Link href="/jobs" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
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
                  <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div>
                      <h3 className="font-medium text-foreground">{job.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{job.documentCount} docs</span>
                        <span className="font-mono text-xs">{new Date(job.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          job.status === 'completed' ? 'bg-emerald-500' :
                          job.status === 'processing' ? 'bg-amber-500 animate-pulse' :
                          job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                        <span className="text-sm font-medium capitalize">{job.status}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <Briefcase className="h-12 w-12 mb-4 opacity-20" />
                <p>No jobs found.</p>
                <p className="text-sm">Create a new job to start analyzing documents.</p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Quick Action</h2>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Create Job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="job-name">Job Name</Label>
                <Input 
                  id="job-name" 
                  placeholder="e.g. Q3 Invoices" 
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  className="font-mono text-sm"
                  data-testid="input-job-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt">Extraction Prompt (Optional)</Label>
                <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                  <SelectTrigger className="font-mono text-sm">
                    <SelectValue placeholder="Select a prompt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Default Analysis)</SelectItem>
                    {prompts?.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
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
                Create & Upload Docs
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
