"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu as MenuIcon, Coffee } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NAV_ITEMS } from "./nav-config";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <MenuIcon className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-0 max-w-full translate-y-0 rounded-none sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coffee className="h-4 w-4" /> ALLEE Backoffice
            </DialogTitle>
          </DialogHeader>
          <nav className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    active ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </DialogContent>
      </Dialog>
    </>
  );
}
