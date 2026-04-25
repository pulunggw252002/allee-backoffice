/**
 * GET /api/internal/webhook-debug
 *
 * Debug endpoint untuk mendiagnosis kenapa POS webhook tidak fire.
 * Returns:
 *   - apakah POS_WEBHOOK_URL & POS_WEBHOOK_SECRET ke-load di runtime
 *   - host portion dari URL (untuk verifikasi target benar, bukan secret)
 *   - hasil fetch ke endpoint POS dengan secret yang dipakai
 *
 * **Authorization:** wajib pakai header `x-debug-key` dengan value
 * `BETTER_AUTH_SECRET` (sudah ada di env, tidak perlu env baru). Ini cukup
 * mengamankan dari curious random visitor; bukan endpoint produksi long-term.
 *
 * Hapus file ini setelah masalah teratasi.
 */
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const debugKey = req.headers.get("x-debug-key") ?? "";
  const expected = process.env.BETTER_AUTH_SECRET ?? "";
  if (!expected || debugKey !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.POS_WEBHOOK_URL?.trim() ?? "";
  const secret = process.env.POS_WEBHOOK_SECRET?.trim() ?? "";

  const out: Record<string, unknown> = {
    env: {
      POS_WEBHOOK_URL_set: Boolean(url),
      POS_WEBHOOK_URL_length: url.length,
      POS_WEBHOOK_URL_host: url ? new URL(url).host : null,
      POS_WEBHOOK_URL_path: url ? new URL(url).pathname : null,
      POS_WEBHOOK_SECRET_set: Boolean(secret),
      POS_WEBHOOK_SECRET_length: secret.length,
      // First and last 2 chars only — buat verifikasi user-side tanpa expose full.
      POS_WEBHOOK_SECRET_fingerprint: secret
        ? `${secret.slice(0, 2)}...${secret.slice(-2)}`
        : null,
    },
  };

  if (!url || !secret) {
    out.test = { skipped: true, reason: "url or secret missing" };
    return NextResponse.json(out);
  }

  // Coba fire ke POS pakai payload dummy.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        entity: "category",
        event: "updated",
        entity_id: "debug-test",
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    out.test = {
      status: res.status,
      ok: res.ok,
      body: text.slice(0, 500),
    };
  } catch (err) {
    out.test = {
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }

  return NextResponse.json(out);
}
