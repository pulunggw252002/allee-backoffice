"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-config";
import type { Role } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Coffee } from "lucide-react";
import { config, appVersionLabel } from "@/lib/config";

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Coffee className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">
            {config.app.shortName}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Backoffice
          </p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const visibleChildren = item.children?.filter((c) =>
              c.roles.includes(role),
            );
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
                {active && visibleChildren && visibleChildren.length > 0 ? (
                  <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                    {visibleChildren.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={cn(
                          "rounded-md px-2 py-1 text-xs transition-colors",
                          pathname === c.href
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
                        )}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-3 text-[11px] text-muted-foreground">
        {config.app.name} {appVersionLabel()}
      </div>
    </aside>
  );
}
