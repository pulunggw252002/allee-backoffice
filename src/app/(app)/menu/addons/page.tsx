"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addonsApi, ingredientsApi } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { AddonGroupDialog } from "@/components/menu/addon-group-form";
import { formatIDR, formatNumber } from "@/lib/format";
import { Plus, Pencil, Trash2, SlidersHorizontal } from "lucide-react";

export default function AddonsPage() {
  const qc = useQueryClient();
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["addonGroups"],
    queryFn: () => addonsApi.listGroups(),
  });
  const { data: ingredients = [] } = useQuery({
    queryKey: ["ingredients", "all"],
    queryFn: () => ingredientsApi.list(),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => addonsApi.removeGroup(id),
    onSuccess: () => {
      toast.success("Group dihapus");
      qc.invalidateQueries({ queryKey: ["addonGroups"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add-on Management"
        description="Kelola add-on group (Sugar Level, Ice Level, Extra Shot) dengan recipe modifier untuk mengubah konsumsi bahan."
        actions={
          <AddonGroupDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> Tambah Group
              </Button>
            }
          />
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Memuat add-on…
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="Belum ada add-on group"
          description="Buat group untuk memungkinkan customer kustomisasi menu."
          action={
            <AddonGroupDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4" /> Tambah Group
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{g.name}</CardTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">
                        {g.selection_type === "single"
                          ? "Pilih 1"
                          : "Pilih banyak"}
                      </Badge>
                      {g.is_required ? (
                        <Badge variant="warning">Wajib</Badge>
                      ) : (
                        <Badge variant="secondary">Opsional</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {g.options.length} opsi
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <AddonGroupDialog
                      initial={g}
                      trigger={
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Hapus group "${g.name}"?`))
                          removeMutation.mutate(g.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {g.options.map((o) => (
                    <li
                      key={o.id}
                      className="rounded-md border p-2 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{o.name}</span>
                        <span className="tabular text-xs text-muted-foreground">
                          {o.extra_price > 0
                            ? `+${formatIDR(o.extra_price)}`
                            : "Gratis"}
                        </span>
                      </div>
                      {o.modifiers.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {o.modifiers.map((m) => {
                            const ing = ingredients.find(
                              (i) => i.id === m.ingredient_id,
                            );
                            return (
                              <li key={m.id}>
                                {ing?.name ?? "?"}:{" "}
                                {m.mode === "override" ? (
                                  <>
                                    set ke{" "}
                                    <span className="tabular">
                                      {formatNumber(m.quantity_delta)}{" "}
                                      {ing?.unit}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="tabular">
                                      {m.quantity_delta > 0 ? "+" : ""}
                                      {formatNumber(m.quantity_delta)}{" "}
                                      {ing?.unit}
                                    </span>
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
