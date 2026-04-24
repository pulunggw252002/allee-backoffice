import type {
  Bundle,
  BundleItem,
  Ingredient,
  Menu,
  RecipeItem,
} from "@/types";
import {
  BUNDLE_MARGIN_GOOD_PCT,
  BUNDLE_MARGIN_WARN_PCT,
  MARGIN_GOOD_PCT,
  MARGIN_WARN_PCT,
} from "@/lib/constants";

export type MarginBadgeVariant = "success" | "warning" | "danger";

/**
 * Map a margin percentage to a Badge variant. Pass `kind: "bundle"` to use
 * the lower bundle thresholds (bundles discount the combined price so margin
 * bands are shifted downward).
 */
export function marginToBadgeVariant(
  marginPct: number,
  kind: "menu" | "bundle" = "menu",
): MarginBadgeVariant {
  const good = kind === "bundle" ? BUNDLE_MARGIN_GOOD_PCT : MARGIN_GOOD_PCT;
  const warn = kind === "bundle" ? BUNDLE_MARGIN_WARN_PCT : MARGIN_WARN_PCT;
  if (marginPct >= good) return "success";
  if (marginPct >= warn) return "warning";
  return "danger";
}

export function calcRecipeHpp(
  recipe: Pick<RecipeItem, "ingredient_id" | "quantity">[],
  ingredients: Pick<Ingredient, "id" | "unit_price">[],
): number {
  return recipe.reduce((sum, r) => {
    const ing = ingredients.find((i) => i.id === r.ingredient_id);
    if (!ing) return sum;
    return sum + r.quantity * ing.unit_price;
  }, 0);
}

export function calcBundleHpp(
  bundle: Pick<Bundle, "id">,
  bundleItems: BundleItem[],
  menus: Pick<Menu, "id" | "hpp_cached">[],
): number {
  return bundleItems
    .filter((bi) => bi.bundle_id === bundle.id)
    .reduce((sum, bi) => {
      const menu = menus.find((m) => m.id === bi.menu_id);
      return sum + (menu?.hpp_cached ?? 0) * bi.quantity;
    }, 0);
}

export function calcMargin(price: number, hpp: number): number {
  if (price <= 0) return 0;
  return ((price - hpp) / price) * 100;
}
