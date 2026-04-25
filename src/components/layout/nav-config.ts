import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  ClipboardList,
  Coffee,
  History,
  LayoutDashboard,
  Plug,
  Settings,
  Users,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  /**
   * Tandai item sebagai "Segera Hadir". Sidebar/mobile-nav merender item ini
   * sebagai non-clickable disabled state + badge "Segera Hadir". Children juga
   * di-skip agar tidak ada cara menavigasi via UI.
   */
  comingSoon?: boolean;
  children?: Array<{ label: string; href: string; roles: Role[] }>;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["owner", "kepala_toko"],
  },
  {
    label: "Absen",
    href: "/attendance",
    icon: ClipboardList,
    roles: ["owner", "kepala_toko", "kasir", "kitchen", "barista", "waiters"],
  },
  {
    label: "Resep",
    href: "/recipes",
    icon: BookOpen,
    roles: ["owner", "kepala_toko", "kitchen", "barista"],
  },
  {
    label: "Menu",
    href: "/menu",
    icon: Coffee,
    roles: ["owner", "kepala_toko"],
    children: [
      { label: "Daftar Menu", href: "/menu", roles: ["owner", "kepala_toko"] },
      { label: "Kategori", href: "/menu/categories", roles: ["owner"] },
      { label: "Add-on", href: "/menu/addons", roles: ["owner"] },
      { label: "Bundling", href: "/menu/bundles", roles: ["owner"] },
      { label: "Diskon", href: "/menu/discounts", roles: ["owner"] },
    ],
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Boxes,
    roles: ["owner", "kepala_toko"],
    children: [
      {
        label: "Bahan Baku",
        href: "/inventory",
        roles: ["owner", "kepala_toko"],
      },
      {
        label: "Stok Masuk",
        href: "/inventory/stock-in",
        roles: ["owner", "kepala_toko"],
      },
      {
        label: "Stok Keluar",
        href: "/inventory/stock-out",
        roles: ["owner", "kepala_toko"],
      },
      {
        label: "Stock Opname",
        href: "/inventory/opname",
        roles: ["owner", "kepala_toko"],
      },
    ],
  },
  {
    label: "User",
    href: "/users",
    icon: Users,
    roles: ["owner"],
  },
  {
    label: "Outlet",
    href: "/outlets",
    icon: Building2,
    roles: ["owner"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["owner", "kepala_toko"],
    children: [
      { label: "Penjualan", href: "/reports/sales", roles: ["owner"] },
      { label: "Profit", href: "/reports/profit", roles: ["owner"] },
      { label: "Inventory", href: "/reports/inventory", roles: ["owner", "kepala_toko"] },
      { label: "Waste", href: "/reports/waste", roles: ["owner", "kepala_toko"] },
      { label: "Order Void", href: "/reports/void", roles: ["owner", "kepala_toko"] },
      { label: "Transaksi", href: "/reports/transactions", roles: ["owner"] },
    ],
  },
  {
    label: "Integrasi",
    href: "/integrations",
    icon: Plug,
    roles: ["owner"],
    comingSoon: true,
    children: [
      {
        label: "Ojol (GoFood / GrabFood / ShopeeFood)",
        href: "/integrations/ojol",
        roles: ["owner"],
      },
    ],
  },
  {
    label: "Audit Log",
    href: "/audit",
    icon: History,
    roles: ["owner"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["owner"],
    children: [
      { label: "Pajak & Service", href: "/settings", roles: ["owner"] },
      { label: "Printer", href: "/settings/printers", roles: ["owner"] },
    ],
  },
];
