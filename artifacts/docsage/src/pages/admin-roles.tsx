import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, type AdminRole, type PermissionKey } from "@/lib/admin-api";
import { Trash2, Plus, Pencil, ShieldCheck } from "lucide-react";

interface Permission { key: PermissionKey; label: string }

export default function AdminRolesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const rolesQ = useQuery<AdminRole[]>({
    queryKey: ["admin", "roles"],
    queryFn: () => apiFetch<AdminRole[]>("/api/admin/roles"),
  });
  const permsQ = useQuery<Permission[]>({
    queryKey: ["admin", "permissions"],
    queryFn: () => apiFetch<Permission[]>("/api/admin/permissions"),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<AdminRole | null>(null);

  const createMut = useMutation({
    mutationFn: (input: { name: string; description?: string; permissions: PermissionKey[] }) =>
      apiFetch("/api/admin/roles", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      setCreateOpen(false);
      toast({ title: "Rola utworzona" });
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...input }: { id: number; name?: string; description?: string; permissions?: PermissionKey[] }) =>
      apiFetch(`/api/admin/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      setEditRole(null);
      toast({ title: "Zaktualizowano" });
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      toast({ title: "Rola usunięta" });
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role i uprawnienia</h1>
          <p className="text-sm text-muted-foreground">Definiuj zakresy dostępu dla użytkowników DocSage.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-role"><Plus className="h-4 w-4 mr-2" />Nowa rola</Button>
          </DialogTrigger>
          <RoleDialog
            permissions={permsQ.data ?? []}
            onSubmit={(v) => createMut.mutate(v)}
            isPending={createMut.isPending}
            mode="create"
          />
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa</TableHead>
              <TableHead>Opis</TableHead>
              <TableHead>Uprawnienia</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rolesQ.isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Ładowanie…</TableCell></TableRow>
            )}
            {rolesQ.data?.map((r) => (
              <TableRow key={r.id} data-testid={`row-role-${r.id}`}>
                <TableCell className="font-medium flex items-center gap-2">
                  {r.isSystem && <ShieldCheck className="h-4 w-4 text-primary" />}
                  {r.name}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-md">{r.description ?? "—"}</TableCell>
                <TableCell><span className="text-xs text-muted-foreground">{r.permissions.length} uprawnień</span></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditRole(r)} data-testid={`button-edit-role-${r.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    disabled={r.isSystem}
                    onClick={() => {
                      if (confirm(`Usunąć rolę „${r.name}"?`)) deleteMut.mutate(r.id);
                    }}
                    data-testid={`button-delete-role-${r.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editRole && (
        <Dialog open={!!editRole} onOpenChange={(o) => !o && setEditRole(null)}>
          <RoleDialog
            permissions={permsQ.data ?? []}
            initial={editRole}
            onSubmit={(v) => updateMut.mutate({ id: editRole.id, ...v })}
            isPending={updateMut.isPending}
            mode="edit"
          />
        </Dialog>
      )}
    </div>
  );
}

function RoleDialog({
  permissions,
  initial,
  onSubmit,
  isPending,
  mode,
}: {
  permissions: Permission[];
  initial?: AdminRole;
  onSubmit: (v: { name: string; description?: string; permissions: PermissionKey[] }) => void;
  isPending: boolean;
  mode: "create" | "edit";
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [selected, setSelected] = useState<Set<PermissionKey>>(new Set(initial?.permissions ?? []));

  function toggle(key: PermissionKey) {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, description: description || undefined, permissions: [...selected] });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "Nowa rola" : "Edycja roli"}</DialogTitle>
        <DialogDescription>Wybierz uprawnienia, które otrzymają użytkownicy z tą rolą.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="role-name">Nazwa</Label>
          <Input id="role-name" required value={name} onChange={(e) => setName(e.target.value)} disabled={initial?.isSystem} data-testid="input-role-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role-desc">Opis</Label>
          <Textarea id="role-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Uprawnienia</Label>
          <div className="space-y-2 rounded-md border border-border p-3 bg-background/50">
            {permissions.map((p) => (
              <label key={p.key} className="flex items-center gap-3 cursor-pointer hover:bg-accent/30 rounded-sm px-2 py-1.5 transition-colors">
                <Checkbox
                  checked={selected.has(p.key)}
                  onCheckedChange={() => toggle(p.key)}
                  data-testid={`checkbox-perm-${p.key}`}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.key}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isPending} data-testid="button-submit-role">
            {isPending ? "Zapisywanie…" : "Zapisz"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
