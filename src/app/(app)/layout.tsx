"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import {
  canAccessBackoffice,
  canAccessManagement,
  defaultLandingForRole,
  STAFF_ALLOWED_PREFIXES,
  KEPALA_TOKO_FORBIDDEN_PREFIXES,
} from "@/lib/rbac";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user || !canAccessBackoffice(user.role)) {
      router.replace("/login");
      return;
    }
    if (!canAccessManagement(user.role)) {
      const prefixes = STAFF_ALLOWED_PREFIXES[user.role] ?? ["/attendance"];
      const allowed = prefixes.some((p) => pathname.startsWith(p));
      if (!allowed) {
        router.replace(defaultLandingForRole(user.role));
      }
      return;
    }
    if (user.role === "kepala_toko") {
      const forbidden = KEPALA_TOKO_FORBIDDEN_PREFIXES.some((p) =>
        pathname.startsWith(p),
      );
      if (forbidden) {
        router.replace("/dashboard");
      }
    }
  }, [hydrated, user, pathname, router]);

  if (!hydrated) {
    return <div className="min-h-screen" />;
  }

  if (!user || !canAccessBackoffice(user.role)) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar role={user.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
