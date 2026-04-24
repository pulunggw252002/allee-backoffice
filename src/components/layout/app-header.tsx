"use client";

import { OutletSwitcher } from "./outlet-switcher";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { useAuthStore } from "@/stores/auth-store";

export function AppHeader() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <MobileNav role={user.role} />
      <div className="flex flex-1 items-center gap-3">
        <OutletSwitcher />
      </div>
      <UserMenu />
    </header>
  );
}
