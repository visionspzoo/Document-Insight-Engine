import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, type AdminRole, type AdminUser } from "@/lib/admin-api";
import { Trash2, UserPlus, Pencil } from "lucide-react";

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const usersQ = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<AdminUser[]>("/api/admin/users"),
  });
  const rolesQ = useQuery<AdminRole[]>({
    queryKey: ["admin", "roles"],
    queryFn: () => apiFetch<AdminRole[]>("/api/admin/roles"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);

  const createMut = useMutation({
    mutationFn: (input: { email: string; password: string; firstName?: string; lastName?: string; roleId?: number }) =>
      apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setCreateOpen(false);
      toast({ title: "Użytkownik utworzony" });
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...input }: { id: string; firstName?: string; lastName?: string; password?: string; roleId?: number | null }) =>
      apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditUser(null);
      toast({ title: "Zaktualizowano" });
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "Użytkownik usunięty" });
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Użytkownicy</h1>
          <p className="text-sm text-muted-foreground">Zarządzaj kontami użytkowników i przypisanymi rolami.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-user"><UserPlus className="h-4 w-4 mr-2" />Dodaj użytkownika</Button>
          </DialogTrigger>
          <UserDialog
            roles={rolesQ.data ?? []}
            onSubmit={(input) => createMut.mutate(input as Parameters<typeof createMut.mutate>[0])}
            isPending={createMut.isPending}
            mode="create"
          />
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>Rola</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQ.isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Ładowanie…</TableCell></TableRow>
            )}
            {usersQ.data?.map((u) => (
              <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                </TableCell>
                <TableCell>
                  {u.role ? (
                    <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                      {u.role.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">brak</span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditUser(u)} data-testid={`button-edit-user-${u.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Usunąć użytkownika ${u.email}?`)) deleteMut.mutate(u.id);
                    }}
                    data-testid={`button-delete-user-${u.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editUser && (
        <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
          <UserDialog
            roles={rolesQ.data ?? []}
            initial={editUser}
            onSubmit={(input) => updateMut.mutate({ id: editUser.id, ...input })}
            isPending={updateMut.isPending}
            mode="edit"
          />
        </Dialog>
      )}
    </div>
  );
}

interface UserFormValues {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  roleId?: number | null;
}

function UserDialog({
  roles,
  initial,
  onSubmit,
  isPending,
  mode,
}: {
  roles: AdminRole[];
  initial?: AdminUser;
  onSubmit: (v: UserFormValues) => void;
  isPending: boolean;
  mode: "create" | "edit";
}) {
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [roleId, setRoleId] = useState<string>(initial?.role?.id ? String(initial.role.id) : "none");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: UserFormValues = {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      roleId: roleId === "none" ? null : Number(roleId),
    };
    if (mode === "create") {
      payload.email = email;
      payload.password = password;
    } else if (password) {
      payload.password = password;
    }
    onSubmit(payload);
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "Nowy użytkownik" : "Edycja użytkownika"}</DialogTitle>
        <DialogDescription>
          {mode === "create" ? "Utwórz konto i przypisz rolę." : "Zaktualizuj dane konta lub zmień rolę."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "create" && (
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-user-email" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">Imię</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Nazwisko</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{mode === "create" ? "Hasło" : "Nowe hasło (opcjonalnie)"}</Label>
          <Input id="password" type="password" required={mode === "create"} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-user-password" />
        </div>
        <div className="space-y-2">
          <Label>Rola</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Brak roli</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isPending} data-testid="button-submit-user">
            {isPending ? "Zapisywanie…" : "Zapisz"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
