"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import {
  addonsApi,
  categoriesApi,
  ingredientsApi,
  menusApi,
  outletsApi,
} from "@/lib/api";
import type { MenuWithRelations } from "@/lib/api/menus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIDR, formatNumber, formatPercent } from "@/lib/format";
import { calcMargin, calcRecipeHpp, marginToBadgeVariant } from "@/lib/hpp";
import { canViewCosts } from "@/lib/rbac";
import { useAuthStore } from "@/stores/auth-store";

interface RecipeRow {
  ingredient_id: string;
  quantity: number;
  notes?: string;
}

const KNOWN_CATEGORY_PREFIX: Record<string, string> = {
  minuman: "MIN",
  makanan: "MKN",
  snack: "SNK",
  dessert: "DES",
};

function categoryPrefix(name: string): string {
  const key = name.toLowerCase().trim();
  if (KNOWN_CATEGORY_PREFIX[key]) return KNOWN_CATEGORY_PREFIX[key];
  const cleaned = name.replace(/[^A-Za-z0-9]/g, "");
  return (cleaned.slice(0, 3) || "MNU").toUpperCase();
}

function nextSkuSequence(prefix: string, existingSkus: string[]): number {
  const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let max = 0;
  for (const s of existingSkus) {
    const m = s.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export function MenuForm({ initial }: { initial?: MenuWithRelations }) {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canSetPrice = canViewCosts(user?.role);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });
  const { data: allMenus = [] } = useQuery({
    queryKey: ["menus", "all"],
    queryFn: () => menusApi.list(),
  });
  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });
  const { data: allIngredients = [] } = useQuery({
    queryKey: ["ingredients", "all"],
    queryFn: () => ingredientsApi.list(),
  });
  const { data: addonGroups = [] } = useQuery({
    queryKey: ["addonGroups"],
    queryFn: () => addonsApi.listGroups(),
  });

  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState<number>(initial?.price ?? 0);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [outletIds, setOutletIds] = useState<string[]>(
    initial?.outlet_ids ?? [],
  );
  const [recipes, setRecipes] = useState<RecipeRow[]>(
    initial?.recipes.map((r) => ({
      ingredient_id: r.ingredient_id,
      quantity: r.quantity,
      notes: r.notes,
    })) ?? [],
  );
  const [addonGroupIds, setAddonGroupIds] = useState<string[]>(
    initial?.addon_group_ids ?? [],
  );

  useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const refOutletId = outletIds[0];
  const ingredientsForOutlet = useMemo(() => {
    if (!refOutletId) return [] as typeof allIngredients;
    return allIngredients.filter((i) => i.outlet_id === refOutletId);
  }, [allIngredients, refOutletId]);

  const hpp = useMemo(() => {
    if (!refOutletId) return 0;
    return calcRecipeHpp(recipes, allIngredients);
  }, [recipes, allIngredients, refOutletId]);

  const margin = calcMargin(price, hpp);

  const autoSku = useMemo(() => {
    if (initial) return initial.sku;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return "";
    const prefix = categoryPrefix(cat.name);
    const seq = nextSkuSequence(
      prefix,
      allMenus.map((m) => m.sku),
    );
    return `${prefix}-${String(seq).padStart(3, "0")}`;
  }, [initial, categories, categoryId, allMenus]);

  const toggleOutlet = (id: string) => {
    setOutletIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAddonGroup = (id: string) => {
    setAddonGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const addRecipeRow = () => {
    const first = ingredientsForOutlet[0];
    if (!first) {
      toast.error("Pilih outlet terlebih dahulu untuk memilih bahan.");
      return;
    }
    setRecipes((prev) => [
      ...prev,
      { ingredient_id: first.id, quantity: 0 },
    ]);
  };

  const updateRecipe = (idx: number, patch: Partial<RecipeRow>) => {
    setRecipes((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  const removeRecipe = (idx: number) => {
    setRecipes((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nama menu wajib diisi");
      if (canSetPrice && price <= 0) throw new Error("Harga harus > 0");
      if (!categoryId) throw new Error("Pilih kategori");
      if (outletIds.length === 0) throw new Error("Pilih minimal 1 outlet");
      if (!autoSku) throw new Error("SKU belum dapat dibuat — cek kategori");
      const payload = {
        name: name.trim(),
        sku: autoSku,
        price,
        description,
        photo_url: photoUrl || undefined,
        is_active: isActive,
        category_id: categoryId,
        outlet_ids: outletIds,
        recipes: recipes.filter((r) => r.ingredient_id && r.quantity > 0),
        addon_group_ids: addonGroupIds,
      };
      if (initial) {
        return menusApi.update(initial.id, payload);
      }
      return menusApi.create(payload);
    },
    onSuccess: () => {
      toast.success(initial ? "Menu diperbarui" : "Menu berhasil ditambahkan");
      qc.invalidateQueries({ queryKey: ["menus"] });
      router.push("/menu");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan menu");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => menusApi.remove(initial!.id),
    onSuccess: () => {
      toast.success("Menu dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["menus"] });
      router.push("/menu");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
      className="grid gap-6 lg:grid-cols-3"
    >
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detail Menu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nama Menu</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="contoh: Ice Latte"
                  disabled={!canSetPrice}
                  readOnly={!canSetPrice}
                />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={autoSku}
                  readOnly
                  disabled
                  placeholder="Pilih kategori dulu"
                />
                <p className="text-xs text-muted-foreground">
                  Dibuat otomatis dari kategori.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  value={categoryId}
                  onValueChange={setCategoryId}
                  disabled={!canSetPrice}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canSetPrice ? (
                <div className="space-y-2">
                  <Label>Harga Jual</Label>
                  <Input
                    type="number"
                    value={price || ""}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    min={0}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat menu untuk kasir/barista"
                disabled={!canSetPrice}
                readOnly={!canSetPrice}
              />
            </div>
            {canSetPrice ? (
              <div className="space-y-2">
                <Label>URL Foto (opsional)</Label>
                <Input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Status Aktif</p>
                <p className="text-xs text-muted-foreground">
                  Non-aktif akan menyembunyikan menu dari POS.
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={!canSetPrice}
              />
            </div>
          </CardContent>
        </Card>

        {canSetPrice ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Outlet yang Menjual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {outlets.map((o) => (
                  <label
                    key={o.id}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      checked={outletIds.includes(o.id)}
                      onCheckedChange={() => toggleOutlet(o.id)}
                    />
                    <div>
                      <p className="text-sm font-medium">{o.name}</p>
                      <p className="text-xs text-muted-foreground">{o.city}</p>
                    </div>
                  </label>
                ))}
              </div>
              {outletIds.length > 1 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Catatan: HPP ditampilkan berdasarkan harga bahan di outlet
                  pertama ({outlets.find((o) => o.id === outletIds[0])?.name}).
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Resep (Bill of Materials)
              </CardTitle>
              {canSetPrice ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRecipeRow}
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah Bahan
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {recipes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {canSetPrice
                  ? "Belum ada bahan. Klik “Tambah Bahan” untuk memulai resep."
                  : "Belum ada bahan."}
              </p>
            ) : canSetPrice ? (
              <div className="space-y-2">
                {recipes.map((r, idx) => {
                  const ing = allIngredients.find(
                    (i) => i.id === r.ingredient_id,
                  );
                  const itemCost = ing ? r.quantity * ing.unit_price : 0;
                  return (
                    <div
                      key={idx}
                      className="space-y-2 rounded-md border p-2"
                    >
                      <div className="grid grid-cols-12 items-center gap-2">
                        <div className="col-span-5">
                          <Select
                            value={r.ingredient_id}
                            onValueChange={(v) =>
                              updateRecipe(idx, { ingredient_id: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ingredientsForOutlet.map((i) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.name} ({i.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-4">
                          <Input
                            type="number"
                            value={r.quantity || ""}
                            onChange={(e) =>
                              updateRecipe(idx, {
                                quantity: Number(e.target.value),
                              })
                            }
                            placeholder="Qty"
                            min={0}
                            step="0.1"
                          />
                        </div>
                        <div className="col-span-2 text-right text-xs tabular text-muted-foreground">
                          {ing
                            ? `${formatIDR(ing.unit_price)}/${ing.unit}`
                            : ""}
                        </div>
                        <div className="col-span-1 text-right text-xs font-medium tabular">
                          {formatIDR(itemCost)}
                        </div>
                        <div className="col-span-1 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRecipe(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Input
                        value={r.notes ?? ""}
                        onChange={(e) =>
                          updateRecipe(idx, { notes: e.target.value })
                        }
                        placeholder="Catatan teknik (opsional) — mis. suhu, waktu ekstraksi, cara potong"
                        className="text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <ul className="divide-y rounded-md border">
                {recipes.map((r, idx) => {
                  const ing = allIngredients.find(
                    (i) => i.id === r.ingredient_id,
                  );
                  return (
                    <li key={idx} className="p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {ing?.name ?? "Bahan tidak ditemukan"}
                        </span>
                        <span className="tabular text-muted-foreground">
                          {formatNumber(r.quantity)} {ing?.unit ?? ""}
                        </span>
                      </div>
                      {r.notes ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.notes}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {!canSetPrice ? (
              <p className="mt-3 text-xs italic text-muted-foreground">
                Resep hanya bisa diubah oleh Owner. Untuk mengubah jumlah stok
                bahan, gunakan menu Inventory.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {canSetPrice ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add-on Group</CardTitle>
            </CardHeader>
            <CardContent>
              {addonGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada add-on group. Buat di halaman Menu → Add-on.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {addonGroups.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <Checkbox
                        checked={addonGroupIds.includes(g.id)}
                        onCheckedChange={() => toggleAddonGroup(g.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{g.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.selection_type === "single" ? "Pilih 1" : "Pilih banyak"}
                          {" · "}
                          {g.options.length} opsi
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {g.options.map((o) => (
                            <Badge key={o.id} variant="outline">
                              {o.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        {canSetPrice ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">HPP & Margin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Harga Jual</span>
                <span className="font-medium tabular">{formatIDR(price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">HPP</span>
                <span className="font-medium tabular">{formatIDR(hpp)}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Profit</span>
                  <span
                    className={
                      price - hpp >= 0
                        ? "text-lg font-semibold tabular text-emerald-600 dark:text-emerald-400"
                        : "text-lg font-semibold tabular text-red-600"
                    }
                  >
                    {formatIDR(price - hpp)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-muted-foreground">Margin</span>
                  <Badge variant={marginToBadgeVariant(margin)}>
                    {formatPercent(margin)}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                HPP dihitung otomatis dari resep × harga bahan. Jika harga bahan
                berubah, HPP menu akan terupdate.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ringkasan Resep</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jumlah bahan</span>
                <span className="font-medium tabular">
                  {recipes.filter((r) => r.quantity > 0).length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Menu & resep dikelola oleh Owner. Gunakan menu Inventory untuk
                mengatur stok bahan.
              </p>
            </CardContent>
          </Card>
        )}

        {recipes.length > 0 && refOutletId ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Konsumsi Bahan per Porsi</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-xs">
                {recipes
                  .filter((r) => r.quantity > 0)
                  .map((r, i) => {
                    const ing = allIngredients.find(
                      (x) => x.id === r.ingredient_id,
                    );
                    if (!ing) return null;
                    return (
                      <li
                        key={i}
                        className="flex justify-between tabular text-muted-foreground"
                      >
                        <span>{ing.name}</span>
                        <span>
                          {formatNumber(r.quantity)} {ing.unit}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-col gap-2">
          {canSetPrice ? (
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {initial ? "Simpan Perubahan" : "Simpan Menu"}
            </Button>
          ) : null}
          {initial && canSetPrice ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (confirm("Nonaktifkan menu ini?")) deleteMutation.mutate();
              }}
            >
              <Trash2 className="h-4 w-4" /> Nonaktifkan Menu
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/menu")}
          >
            Batal
          </Button>
        </div>
      </div>
    </form>
  );
}
