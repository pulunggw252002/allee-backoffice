import type { Role } from "@/types";

export const MANAGEMENT_ROLES: Role[] = ["owner", "kepala_toko"];
export const STAFF_ROLES: Role[] = ["kasir", "kitchen", "barista", "waiters"];

type Resource =
  | "dashboard"
  | "menu"
  | "inventory"
  | "users"
  | "outlets"
  | "reports"
  | "audit"
  | "attendance"
  | "recipes"
  | "stock_opname_approval";

type Action = "view" | "create" | "update" | "delete";

const MATRIX: Record<Role, Partial<Record<Resource, Action[]>>> = {
  owner: {
    dashboard: ["view"],
    menu: ["view", "create", "update", "delete"],
    inventory: ["view", "create", "update", "delete"],
    users: ["view", "create", "update", "delete"],
    outlets: ["view", "create", "update", "delete"],
    reports: ["view"],
    audit: ["view"],
    attendance: ["view"],
    recipes: ["view"],
    stock_opname_approval: ["view", "update"],
  },
  kepala_toko: {
    dashboard: ["view"],
    menu: ["view"],
    inventory: ["view", "create", "update"],
    reports: ["view"],
    attendance: ["view"],
    recipes: ["view"],
    stock_opname_approval: ["view"],
  },
  kitchen: {
    attendance: ["view", "create", "update"],
    recipes: ["view"],
  },
  barista: {
    attendance: ["view", "create", "update"],
    recipes: ["view"],
  },
  kasir: {
    attendance: ["view", "create", "update"],
  },
  waiters: {
    attendance: ["view", "create", "update"],
  },
};

export function can(role: Role | undefined, action: Action, resource: Resource) {
  if (!role) return false;
  const actions = MATRIX[role]?.[resource];
  return Boolean(actions?.includes(action));
}

export function canAccessBackoffice(role: Role | undefined) {
  if (!role) return false;
  return Boolean(MATRIX[role]);
}

export function canAccessManagement(role: Role | undefined) {
  if (!role) return false;
  return MANAGEMENT_ROLES.includes(role);
}

export function isAllOutletsAllowed(role: Role | undefined) {
  return role === "owner";
}

export function defaultLandingForRole(role: Role): string {
  if (MANAGEMENT_ROLES.includes(role)) return "/dashboard";
  return "/attendance";
}

/**
 * Route gate: which path prefixes each staff role may visit.
 * Staff roles (kasir, waiters, barista, kitchen) are funneled into a small
 * set of self-service tools. Anything else redirects to their default page.
 */
export const STAFF_ALLOWED_PREFIXES: Record<Role, string[]> = {
  owner: [],
  kepala_toko: [],
  kasir: ["/attendance"],
  waiters: ["/attendance"],
  barista: ["/attendance", "/recipes"],
  kitchen: ["/attendance", "/recipes"],
};

/**
 * Route gate: paths that Kepala Toko may NOT visit (Owner-only areas like
 * user management, outlet CRUD, audit, global reports, and pricing screens).
 */
export const KEPALA_TOKO_FORBIDDEN_PREFIXES: readonly string[] = [
  "/users",
  "/outlets",
  "/audit",
  "/settings",
  "/integrations",
  "/menu/new",
  "/menu/addons",
  "/menu/bundles",
  "/menu/discounts",
  "/reports/sales",
  "/reports/profit",
  "/reports/transactions",
];

/** True if `role` may see cost/pricing/value fields (HPP, unit price, stock value). */
export function canViewCosts(role: Role | undefined): boolean {
  return role === "owner";
}

/** True if `role` may edit ingredient master data (add, remove, set price). */
export function canManageInventoryMaster(role: Role | undefined): boolean {
  return role === "owner";
}

/** True if `role` may record stock movements (stock-in, stock-out, opname). */
export function canRecordStockMovement(role: Role | undefined): boolean {
  return role === "owner" || role === "kepala_toko";
}
