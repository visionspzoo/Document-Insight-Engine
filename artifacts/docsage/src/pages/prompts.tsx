import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPrompts,
  useCreatePrompt,
  useUpdatePrompt,
  useDeletePrompt,
  useGetDefaultPromptTemplates,
  getListPromptsQueryKey,
  getGetDefaultPromptTemplatesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Database, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PromptForm = {
  name: string;
  description: string;
  extractionPrompt: string;
  analysisPrompt: string;
  category: string;
};

const EMPTY_FORM: PromptForm = {
  name: "",
  description: "",
  extractionPrompt: "",
  analysisPrompt: "",
  category: "",
};

export default function Prompts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: prompts, isLoading } = useListPrompts({
    query: { queryKey: getListPromptsQueryKey() },
  });
  const { data: templates, isLoading: templatesLoading } = useGetDefaultPromptTemplates({
    query: { queryKey: getGetDefaultPromptTemplatesQueryKey() },
  });

  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const deletePrompt = useDeletePrompt();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PromptForm>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: {
    id: number;
    name: string;
    description?: string | null;
    extractionPrompt: string;
    analysisPrompt?: string | null;
    category?: string | null;
  }) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      extractionPrompt: p.extractionPrompt,
      analysisPrompt: p.analysisPrompt ?? "",
      category: p.category ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.extractionPrompt) {
      toast({
        title: "Błąd",
        description: "Nazwa i szablon ekstrakcji są wymagane",
        variant: "destructive",
      });
      return;
    }
    const data = {
      name: form.name,
      description: form.description || null,
      extractionPrompt: form.extractionPrompt,
      analysisPrompt: form.analysisPrompt || null,
      category: form.category || null,
    };
    if (editingId) {
      updatePrompt.mutate(
        { id: editingId, data },
        {
          onSuccess: () => {
            toast({ title: "Zapisano", description: "Szablon zaktualizowany" });
            queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey() });
            setDialogOpen(false);
          },
          onError: () =>
            toast({ title: "Błąd", description: "Nie udało się zaktualizować szablonu", variant: "destructive" }),
        }
      );
    } else {
      createPrompt.mutate(
        { data },
        {
          onSuccess: () => {
            toast({ title: "Utworzono", description: "Szablon zapisany w bibliotece" });
            queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey() });
            setDialogOpen(false);
          },
          onError: () =>
            toast({ title: "Błąd", description: "Nie udało się utworzyć szablonu", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    deletePrompt.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Usunięto", description: "Szablon usunięty z biblioteki" });
          queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey() });
          setDeleteConfirmId(null);
        },
        onError: () =>
          toast({ title: "Błąd", description: "Nie udało się usunąć szablonu", variant: "destructive" }),
      }
    );
  };

  const importTemplate = (t: {
    name: string;
    description: string;
    extractionPrompt: string;
    analysisPrompt: string;
    category: string;
  }) => {
    createPrompt.mutate(
      {
        data: {
          name: t.name,
          description: t.description,
          extractionPrompt: t.extractionPrompt,
          analysisPrompt: t.analysisPrompt,
          category: t.category,
          isTemplate: true,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Zaimportowano", description: `"${t.name}" dodany do Twojej biblioteki` });
          queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey() });
        },
        onError: () =>
          toast({ title: "Błąd", description: "Nie udało się zaimportować szablonu", variant: "destructive" }),
      }
    );
  };

  const isPending = createPrompt.isPending || updatePrompt.isPending;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Biblioteka szablonów</h1>
          <p className="text-muted-foreground mt-1">
            Definiuj instrukcje ekstrakcji i analizy dla swoich dokumentów.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2" data-testid="button-new-prompt">
          <Plus className="h-4 w-4" />
          Nowy szablon
        </Button>
      </div>

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library" data-testid="tab-library">Moja biblioteka</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">Szablony domyślne</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <CardContent className="p-6">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : prompts && prompts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prompts.map((p) => (
                <Card
                  key={p.id}
                  className="bg-card/50 border-border/50 hover:bg-card hover:border-border transition-all"
                  data-testid={`card-prompt-${p.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{p.name}</CardTitle>
                        {p.category && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {p.category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(p)}
                          data-testid={`button-edit-prompt-${p.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(p.id)}
                          data-testid={`button-delete-prompt-${p.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {p.description && (
                      <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                    )}
                    <div className="rounded-md bg-background/60 border border-border/40 p-3">
                      <p className="text-xs font-mono text-muted-foreground line-clamp-3">
                        {p.extractionPrompt}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Brak szablonów</p>
              <p className="text-sm mt-1">Utwórz pierwszy szablon lub zaimportuj z gotowych wzorców.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          {templatesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <CardContent className="p-6">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates?.map((t, i) => (
                <Card
                  key={i}
                  className="bg-card/50 border-border/50 hover:bg-card hover:border-border transition-all"
                  data-testid={`card-template-${i}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base">{t.name}</CardTitle>
                        {t.category && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {t.category}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 flex-shrink-0"
                        onClick={() => importTemplate(t)}
                        data-testid={`button-import-template-${i}`}
                      >
                        <Download className="h-3 w-3" />
                        Importuj
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-2">{t.description}</p>
                    <div className="rounded-md bg-background/60 border border-border/40 p-3">
                      <p className="text-xs font-mono text-muted-foreground line-clamp-3">
                        {t.extractionPrompt}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edytuj szablon" : "Nowy szablon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nazwa *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="np. Ekstrakcja umów"
                  data-testid="input-prompt-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategoria</Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="np. Prawne, Finanse"
                  data-testid="input-prompt-category"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Opis</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Krótki opis działania szablonu"
                data-testid="input-prompt-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extraction">Instrukcja ekstrakcji *</Label>
              <Textarea
                id="extraction"
                value={form.extractionPrompt}
                onChange={(e) => setForm({ ...form, extractionPrompt: e.target.value })}
                placeholder="Instrukcje dotyczące danych do wyodrębnienia z dokumentu..."
                className="min-h-28 font-mono text-sm resize-y"
                data-testid="input-prompt-extraction"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="analysis">
                Instrukcja analizy <span className="text-muted-foreground text-xs">(opcjonalnie)</span>
              </Label>
              <Textarea
                id="analysis"
                value={form.analysisPrompt}
                onChange={(e) => setForm({ ...form, analysisPrompt: e.target.value })}
                placeholder="Instrukcje dotyczące analizy wyodrębnionych danych..."
                className="min-h-24 font-mono text-sm resize-y"
                data-testid="input-prompt-analysis"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-prompt">
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={isPending} data-testid="button-save-prompt">
              {isPending ? "Zapisywanie..." : "Zapisz szablon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń szablon</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Spowoduje to trwałe usunięcie tego szablonu. Tej operacji nie można cofnąć.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deletePrompt.isPending}
              data-testid="button-confirm-delete"
            >
              {deletePrompt.isPending ? "Usuwanie..." : "Usuń"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
