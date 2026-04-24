"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export default function ReportsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    router.replace(
      user.role === "owner" ? "/reports/sales" : "/reports/inventory",
    );
  }, [user, router]);

  return null;
}
