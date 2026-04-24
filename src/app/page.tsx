"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { defaultLandingForRole } from "@/lib/rbac";

export default function RootIndex() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace(defaultLandingForRole(user.role));
  }, [user, router]);

  return <div className="min-h-screen" />;
}
