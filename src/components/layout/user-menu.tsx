"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun, User as UserIcon, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useOutletStore } from "@/stores/outlet-store";
import { resetDb } from "@/lib/mock/db";
import { config } from "@/lib/config";
import * as usersApi from "@/lib/api/users";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RoleBadge } from "@/components/shared/role-badge";
import { ROLE_LABEL } from "@/types";

export function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setOutletId = useOutletStore((s) => s.setOutletId);
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    // Clear Better Auth cookie when running against a real backend; no-op
    // otherwise. Always clear client state + navigate.
    await usersApi.logout();
    logout();
    setOutletId(null);
    router.push("/login");
  };

  const handleReset = () => {
    resetDb();
    toast.success("Database mock direset ke seed awal. Refresh halaman untuk melihat data baru.");
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4 dark:hidden" />
        <Moon className="hidden h-4 w-4 dark:block" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left md:block">
              <p className="text-xs font-medium leading-none">{user.name}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {ROLE_LABEL[user.role]}
              </p>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex items-center gap-2">
              <UserIcon className="h-3.5 w-3.5" />
              <span>{user.name}</span>
            </div>
            <div className="mt-2">
              <RoleBadge role={user.role} />
            </div>
          </DropdownMenuLabel>
          {!config.api.useRealBackend ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReset}>
                <RefreshCw className="h-3.5 w-3.5" /> Reset data demo
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600">
            <LogOut className="h-3.5 w-3.5" /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
