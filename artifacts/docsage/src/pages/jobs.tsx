import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  useListJobs,
  useCreateJob,
  useDeleteJob,
  useListPrompts,
  getListJobsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Briefcase, FileText, Trash2, ArrowRight, CheckCircle2, AlertCircle, Clock, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG = {
  pending: { color: "bg-blue-500", label: "Pending", icon: Clock },
  processing: { color: "bg-amber-500", label: "Processing", icon: Activity, pulse: true },
  completed: { color: "bg-emerald-500", label: "Completed", icon: CheckCircle2 },
  failed: { color: "bg-red-500", label: "Failed", icon: AlertCircle },
};

export default function Jobs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: jobs, isLoading } = useListJobs({ query: { queryKey: getListJobsQueryKey() } });
  const { data: prompts } = useListPrompts();
  const createJob = useCreateJob();
  const deleteJob = useDeleteJob();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [jobName, setJobName] = useState("");
  const [promptId, setPromptId] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleCreate = () => {
    if (!jobName) {
      toast({ title: "Error", description: "Job name is required", variant: "destructive" });
      return;
    }
    createJob.mutate({
      data: {
        name: jobName,
        promptId: promptId && promptId !== "none" ? parseInt(promptId, 10) : null,
      },
    }, {
      onSuccess: (job) => {
        toast({ title: "Created", description: `Job "${job.name}" created` });
        queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        setDialogOpen(false);
        setJobName("");
        setPromptId("");
        setLocation(`/jobs/${job.id}`);
      },
      onError: () => toast({ title: "Error", description: "Failed to create job", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteJob.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted", description: "Job removed" });
        queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        setDeleteConfirmId(null);
      },
      onError: () => toast({ title: "Error", description: "Failed to delete job", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processing Jobs</h1>
          <p className="text-muted-foreground mt-1">Manage document extraction and analysis tasks.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2" data-testid="button-new-job">
          <Plus className="h-4 w-4" />
          New Job
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job, index) => {
            const status = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;
            return (
              <Card
                key={job.id}
                className="bg-card/50 border-border/50 hover:bg-card hover:border-border transition-all group"
                style={{ animationDelay: `${index * 50}ms` }}
                data-testid={`card-job-${job.id}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`flex-shrink-0 p-2 rounded-full bg-background border border-border`}>
                    <StatusIcon className={`h-5 w-5 ${job.status === 'processing' ? 'animate-spin text-amber-500' : job.status === 'completed' ? 'text-emerald-500' : job.status === 'failed' ? 'text-red-500' : 'text-blue-500'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{job.name}</h3>
                      <Badge variant={job.status === 'completed' ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {job.documentCount} doc{job.documentCount !== 1 ? 's' : ''}
                      </span>
                      {job.processedCount > 0 && (
                        <span className="font-mono text-xs">{job.processedCount}/{job.documentCount} processed</span>
                      )}
                      <span className="font-mono text-xs">{new Date(job.createdAt).toLocaleDateString('pl-PL')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.preventDefault(); setDeleteConfirmId(job.id); }} data-testid={`button-delete-job-${job.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="ghost" size="icon" data-testid={`button-open-job-${job.id}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <Briefcase className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-lg">No jobs yet</p>
          <p className="text-sm mt-1">Create your first processing job to get started.</p>
          <Button onClick={() => setDialogOpen(true)} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Create First Job
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="job-name">Job Name *</Label>
              <Input id="job-name" value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="e.g. Q1 2024 Contracts" data-testid="input-new-job-name" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt-select">Extraction Prompt <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={promptId} onValueChange={setPromptId}>
                <SelectTrigger data-testid="select-job-prompt">
                  <SelectValue placeholder="Select a prompt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — Default Analysis</SelectItem>
                  {prompts?.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createJob.isPending} data-testid="button-create-job-confirm">
              {createJob.isPending ? "Creating..." : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">This will permanently delete the job and all its documents and results.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} disabled={deleteJob.isPending} data-testid="button-confirm-delete-job">
              {deleteJob.isPending ? "Deleting..." : "Delete Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
