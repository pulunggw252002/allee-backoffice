/**
 * Fire-and-forget webhook ke POS supaya cache catalog/users di sana
 * langsung ke-revalidate setiap kali owner mengubah data di backoffice.
 *
 * Filosofi:
 *  - **Best-effort, non-blocking.** Mutation route (mis. PATCH /api/menus/:id)
 *    TIDAK boleh gagal hanya karena POS lagi down. Jadi kita catch semua
 *    error, log ringan, dan return — request user tetap sukses.
 *  - **Dipanggil setelah DB write committed.** Race-condition prevention:
 *    POS ketika menerima webhook akan POST /api/backoffice/sync, yang
 *    GET-back catalog. Kalau kita fire sebelum commit, POS bisa fetch state
 *    lama. Selalu panggil di akhir handler (setelah `return after;` di route
 *    asli kita pindah ke `try { ... } finally { fire(...) }` pattern).
 *  - **Auth via shared bearer secret.** POS validasi
 *    `Authorization: Bearer ${POS_WEBHOOK_SECRET}`. Generate sekali, simpan
 *    di env kedua project. Tanpa secret yang cocok, POS tolak 401.
 *  - **Tidak ada queue / retry.** POS punya safety net berupa Vercel Cron
 *    daily sync + tombol manual sync di UI. Webhook ini cuma "nice-to-have"
 *    yang ngebikin update dirasa real-time. Kalau miss sekali, max delay
 *    sampai cron next jalan.
 *
 * Env yang dipakai (baca di runtime, bukan import-time, supaya restart Vercel
 * tanpa redeploy bisa pickup):
 *  - `POS_WEBHOOK_URL` — full URL endpoint POS, contoh
 *    `https://allee-pos.vercel.app/api/backoffice/webhook`. Kalau kosong,
 *    helper langsung no-op (development tanpa POS).
 *  - `POS_WEBHOOK_SECRET` — shared bearer token. Wajib diisi kalau URL ada.
 */

export type PosSyncEntity =
  | "menu"
  | "category"
  | "user"
  | "pos_pin"
  | "addon_group"
  | "bundle"
  | "discount"
  | "ingredient"
  | "outlet"
  | "tax_settings";

export type PosSyncEvent = "created" | "updated" | "deleted";

export interface PosSyncPayload {
  /** ISO timestamp saat webhook di-fire (server time backoffice). */
  ts: string;
  entity: PosSyncEntity;
  event: PosSyncEvent;
  /** ID record yang berubah. Untuk tax_settings (singleton) → "global". */
  entity_id: string;
  /** Optional: outlet scope kalau entity multi-outlet (mis. ingredient). */
  outlet_id?: string;
}

/** Default 4 detik. POS endpoint cukup ringan (cuma trigger sync), tapi kita
 * pasang timeout pendek supaya request mutation di backoffice tidak ketahan
 * lama kalau POS lagi cold-start. */
const DEFAULT_TIMEOUT_MS = 4_000;

function readWebhookConfig(): { url: string; secret: string } | null {
  const url = process.env.POS_WEBHOOK_URL?.trim();
  const secret = process.env.POS_WEBHOOK_SECRET?.trim();
  if (!url || !secret) return null;
  return { url, secret };
}

/**
 * Kirim notifikasi ke POS. **Tidak pernah throw** — semua error di-swallow
 * dan di-log ke `console.warn`. Caller bebas `await` atau tidak;
 * kalau di-await maksimum tertahan `DEFAULT_TIMEOUT_MS`.
 *
 * Pemakaian umum:
 * ```ts
 * // di akhir handler PATCH /api/menus/:id
 * void firePosSync({ entity: "menu", event: "updated", entity_id: id });
 * return after;
 * ```
 *
 * Catatan: `void` di depan call membuat ESLint senang dan secara eksplisit
 * mengisyaratkan "fire-and-forget" kepada pembaca berikutnya.
 */
export async function firePosSync(
  payload: Omit<PosSyncPayload, "ts">,
  opts?: { timeoutMs?: number },
): Promise<void> {
  const cfg = readWebhookConfig();
  if (!cfg) return; // Dev mode tanpa POS — no-op.

  const body: PosSyncPayload = {
    ts: new Date().toISOString(),
    ...payload,
  };

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.secret}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      // Body dibaca buat log, tapi jangan throw — caller route tidak peduli.
      const text = await res.text().catch(() => "");
      console.warn(
        `[pos-sync] POS webhook returned ${res.status} for ${payload.entity}/${payload.event}/${payload.entity_id}: ${text.slice(0, 200)}`,
      );
    }
  } catch (err) {
    // Network error / abort. Tetap swallow.
    console.warn(
      `[pos-sync] POS webhook failed for ${payload.entity}/${payload.event}/${payload.entity_id}:`,
      err instanceof Error ? err.message : err,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Helper convenience: kirim webhook tanpa menunggu (fire-and-forget benar-benar).
 * Pakai ini di mutation route supaya response user balik secepat mungkin.
 *
 * **Caveat Vercel:** di Vercel serverless, function instance bisa freeze
 * setelah response dikirim. Untuk reliability tinggi gunakan `await firePosSync(...)`
 * sebelum `return`. Trade-off: latency mutation +200-500ms (bagus untuk consistency).
 */
export function firePosSyncNoWait(
  payload: Omit<PosSyncPayload, "ts">,
): void {
  void firePosSync(payload).catch(() => {
    // Sudah di-handle di dalam firePosSync, ini cuma supaya unhandled rejection
    // tidak crash worker.
  });
}
