import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { config } from "@/lib/config";

export function formatIDR(value: number, opts?: { compact?: boolean }) {
  const sym = config.locale.currencySymbol;
  if (opts?.compact) {
    if (value >= 1_000_000_000)
      return `${sym} ${(value / 1_000_000_000).toFixed(1)}M`;
    if (value >= 1_000_000) return `${sym} ${(value / 1_000_000).toFixed(1)}jt`;
    if (value >= 1_000) return `${sym} ${(value / 1_000).toFixed(0)}rb`;
  }
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  const str = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${sym} ${str}`;
}

export function formatNumber(value: number, maxFraction = 2) {
  return new Intl.NumberFormat(config.locale.lang, {
    maximumFractionDigits: maxFraction,
  }).format(value);
}

export function formatPercent(value: number, fraction = 1) {
  return `${value.toFixed(fraction)}%`;
}

export function formatDate(date: string | Date) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy", { locale: idLocale });
}

export function formatDateTime(date: string | Date) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy HH:mm", { locale: idLocale });
}

export function formatRelativeDay(date: string | Date) {
  const d = typeof date === "string" ? parseISO(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Besok";
  if (diff === -1) return "Kemarin";
  return formatDate(d);
}
