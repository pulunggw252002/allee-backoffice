import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  hint?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "text-red-600 dark:text-red-400"
          : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <div className="rounded-md border bg-background p-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        ) : null}
      </div>
      <p className={cn("mt-3 text-2xl font-semibold tabular", toneClass)}>
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {delta ? <span className="font-medium">{delta}</span> : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}
