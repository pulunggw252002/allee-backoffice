"use client";

import { PageHeader } from "@/components/shared/page-header";
import { MenuForm } from "@/components/menu/menu-form";

export default function NewMenuPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tambah Menu"
        description="Isi detail menu, pilih outlet yang menjual, dan susun resep bahan baku untuk menghitung HPP otomatis."
      />
      <MenuForm />
    </div>
  );
}
