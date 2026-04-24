/**
 * Central runtime config — reads from `NEXT_PUBLIC_*` env with safe fallbacks.
 * Keep fallbacks functional so a fresh clone boots without an `.env` file.
 *
 * IMPORTANT: Next.js inlines `process.env.NEXT_PUBLIC_*` ONLY at the literal
 * access site. Do NOT alias `process.env` into a variable — that leaves an
 * undefined reference in the client bundle. Each env var must be read via
 * `process.env.NEXT_PUBLIC_<NAME>` directly below.
 */

function parseInt_(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseBool_(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

function parseStr_(v: string | undefined, fallback: string): string {
  return v && v.length > 0 ? v : fallback;
}

export const config = {
  app: {
    name: parseStr_(process.env.NEXT_PUBLIC_APP_NAME, "ALLEE Backoffice"),
    shortName: parseStr_(process.env.NEXT_PUBLIC_APP_SHORT_NAME, "ALLEE"),
    version: parseStr_(process.env.NEXT_PUBLIC_APP_VERSION, "0.1.0"),
    channel: parseStr_(process.env.NEXT_PUBLIC_APP_CHANNEL, "MVP"),
  },
  locale: {
    lang: parseStr_(process.env.NEXT_PUBLIC_LOCALE, "id-ID"),
    currencyCode: parseStr_(process.env.NEXT_PUBLIC_CURRENCY_CODE, "IDR"),
    currencySymbol: parseStr_(process.env.NEXT_PUBLIC_CURRENCY_SYMBOL, "Rp"),
    timezone: parseStr_(process.env.NEXT_PUBLIC_TIMEZONE, "Asia/Jakarta"),
  },
  storage: {
    prefix: parseStr_(process.env.NEXT_PUBLIC_STORAGE_PREFIX, "allee"),
    version: parseStr_(process.env.NEXT_PUBLIC_STORAGE_VERSION, "v6"),
  },
  api: {
    /** Base URL for the future real backend. When empty, the mock layer is used. */
    baseUrl: parseStr_(process.env.NEXT_PUBLIC_API_BASE_URL, ""),
    /** Simulated latency for the in-memory mock (ms). */
    mockLatencyMs: parseInt_(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS, 120),
    /** When true, API layer will call `baseUrl` instead of the mock. */
    useRealBackend: parseBool_(
      process.env.NEXT_PUBLIC_USE_REAL_BACKEND,
      false,
    ),
    /** TanStack Query `staleTime` (ms) — how long a fetched result is fresh. */
    staleTimeMs: parseInt_(process.env.NEXT_PUBLIC_QUERY_STALE_MS, 30_000),
  },
  images: {
    /**
     * Comma-separated list of allowed remote image hostnames for `next/image`.
     * Consumed at build time by `next.config.ts`.
     */
    remoteHostnames: parseStr_(
      process.env.NEXT_PUBLIC_IMAGE_REMOTE_HOSTS,
      "images.unsplash.com",
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
};

/** Build a namespaced localStorage key: `allee:v1:<name>`. */
export function storageKey(name: string): string {
  return `${config.storage.prefix}:${config.storage.version}:${name}`;
}

/** Full app version label for UI display: "v0.1.0 · MVP". */
export function appVersionLabel(): string {
  return `v${config.app.version} · ${config.app.channel}`;
}
