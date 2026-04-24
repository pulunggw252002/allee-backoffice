"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Coffee, Loader2, Search, StickyNote } from "lucide-react";
import {
  categoriesApi,
  ingredientsApi,
  menusApi,
  outletsApi,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useOutletStore } from "@/stores/outlet-store";
import { canAccessManagement } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { formatIDR, formatNumber } from "@/lib/format";
import type { Role } from "@/types";

const DRINK_CATEGORY_KEYWORDS = ["minuman", "drink", "beverage"];

function recipeRoleScope(role: Role | undefined): "all" | "drinks" | "food" {
  if (!role) return "all";
  if (role === "barista") return "drinks";
  if (role === "kitchen") return "food";
  return "all";
}

function isDrinkCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return DRINK_CATEGORY_KEYWORDS.some((kw) => lower.includes(kw));
}

export default function RecipesPage() {
  const user = useAuthStore((s) => s.user);
  const selectedOutletId = useOutletStore((s) => s.selectedOutletId);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: outlets = [] } = useQuery({
    queryKey: ["outlets"],
    queryFn: () => outletsApi.list(),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });
  const { data: allMenus = [], isLoading: loadingMenus } = useQuery({
    queryKey: ["menus", "all"],
    queryFn: () => menusApi.list(),
  });
  const { data: allIngredients = [] } = useQuery({
    queryKey: ["ingredients", "all"],
    queryFn: () => ingredientsApi.list(),
  });

  const scope = recipeRoleScope(user?.role);
  const showPrice = user ? canAccessManagement(user.role) : false;
  const outletIdForIngredients =
    user?.outlet_id ?? selectedOutletId ?? outlets[0]?.id ?? null;

  const allowedCategoryIds = useMemo(() => {
    if (scope === "drinks") {
      return categories.filter((c) => isDrinkCategory(c.name)).map((c) => c.id);
    }
    if (scope === "food") {
      return categories
        .filter((c) => !isDrinkCategory(c.name))
        .map((c) => c.id);
    }
    return categories.map((c) => c.id);
  }, [categories, scope]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => allowedCategoryIds.includes(c.id)),
    [categories, allowedCategoryIds],
  );

  const filteredMenus = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMenus
      .filter((m) => allowedCategoryIds.includes(m.category_id))
      .filter((m) =>
        categoryFilter === "all" ? true : m.category_id === categoryFilter,
      )
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true))
      .filter((m) => m.is_active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allMenus, allowedCategoryIds, categoryFilter, search]);

  const ingredientLookup = useMemo(() => {
    const map = new Map<string, (typeof allIngredients)[number]>();
    for (const i of allIngredients) {
      if (outletIdForIngredients && i.outlet_id !== outletIdForIngredients)
        continue;
      if (!map.has(i.id)) map.set(i.id, i);
    }
    for (const i of allIngredients) {
      if (!map.has(i.id)) map.set(i.id, i);
    }
    return map;
  }, [allIngredients, outletIdForIngredients]);

  if (!user) return null;

  const pageDescription =
    scope === "drinks"
      ? "Referensi resep minuman: bahan, takaran, dan catatan teknik peracikan."
      : scope === "food"
        ? "Referensi resep makanan, snack & dessert: bahan, takaran, dan catatan teknik."
        : "Referensi resep menu: bahan, takaran, dan catatan teknik per bahan.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resep"
        description={pageDescription}
        actions={
          <Badge variant="secondary">
            {scope === "drinks"
              ? "Barista · minuman"
              : scope === "food"
                ? "Kitchen · makanan, snack & dessert"
                : "Semua menu"}
          </Badge>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama menu…"
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="md:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {visibleCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loadingMenus ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat resep…
          </CardContent>
        </Card>
      ) : filteredMenus.length === 0 ? (
        <EmptyState
          icon={scope === "drinks" ? Coffee : BookOpen}
          title="Belum ada resep"
          description={
            scope === "drinks"
              ? "Belum ada menu minuman aktif."
              : "Belum ada menu aktif sesuai filter."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredMenus.map((menu) => {
            const categoryName =
              categories.find((c) => c.id === menu.category_id)?.name ?? "—";
            return (
              <Card key={menu.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {menu.name}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {categoryName} · SKU {menu.sku}
                      </p>
                    </div>
                    {showPrice ? (
                      <div className="text-right">
                        <p className="text-xs uppercase text-muted-foreground">
                          Harga
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatIDR(menu.price)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {menu.description ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {menu.description}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {menu.recipes.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">
                      Belum ada resep untuk menu ini.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bahan</TableHead>
                          <TableHead className="text-right">Takaran</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {menu.recipes.map((r) => {
                          const ing = ingredientLookup.get(r.ingredient_id);
                          const name = ing?.name ?? "—";
                          const unit = ing?.unit ?? "";
                          return (
                            <Fragment key={r.id}>
                              <TableRow>
                                <TableCell className="font-medium">
                                  {name}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatNumber(r.quantity)} {unit}
                                </TableCell>
                              </TableRow>
                              {r.notes ? (
                                <TableRow className="border-t-0">
                                  <TableCell colSpan={2} className="pt-0">
                                    <div className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                                      <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                      <span>{r.notes}</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
