/**
 * Printers API client — talks to /api/printers (real backend).
 *
 * Tidak ada mock layer untuk fitur ini: printer adalah master data baru yang
 * dipakai live di production via real backend. Saat `config.api.useRealBackend`
 * false (mode demo lama), `list` return [] sehingga UI tampil "belum ada
 * printer" — owner masih bisa explore halaman tanpa crash.
 */
import { config } from "@/lib/config";
import { http } from "./http";
import { qs } from "./_qs";

export type PrinterType = "cashier" | "kitchen" | "bar" | "label";
export type PrinterConnection = "usb" | "bluetooth" | "network" | "other";

export interface Printer {
  id: string;
  outlet_id: string;
  code: string;
  name: string;
  type: PrinterType;
  connection: PrinterConnection;
  address: string | null;
  paper_width: number;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function list(params?: { outlet_id?: string | null }): Promise<Printer[]> {
  if (!config.api.useRealBackend) return [];
  return http.get<Printer[]>(
    `/api/printers${qs({ outlet_id: params?.outlet_id ?? null })}`,
  );
}

export interface PrinterCreateInput {
  outlet_id: string;
  code: string;
  name: string;
  type: PrinterType;
  connection: PrinterConnection;
  address?: string | null;
  paper_width: number;
  note?: string | null;
  is_active: boolean;
}

export async function create(input: PrinterCreateInput): Promise<Printer> {
  return http.post<Printer>("/api/printers", input);
}

export type PrinterUpdateInput = Partial<Omit<PrinterCreateInput, "outlet_id">>;

export async function update(id: string, input: PrinterUpdateInput): Promise<Printer> {
  return http.patch<Printer>(`/api/printers/${id}`, input);
}

export async function remove(id: string): Promise<void> {
  await http.del<{ ok: true }>(`/api/printers/${id}`);
}
