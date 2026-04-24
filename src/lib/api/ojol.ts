/**
 * Ojol (online food delivery) integration API.
 *
 * Covers three resources:
 *  1. `channels`  — per-outlet × per-platform credentials and connection state.
 *  2. `listings`  — per-menu × per-platform price override + availability.
 *  3. `syncLogs`  — history of sync runs (manual or auto-triggered).
 *
 * The real-backend branch hits `/api/ojol/*` endpoints. The mock branch
 * mutates the in-memory DB directly. A "sync" in mock mode just flips
 * `sync_status` to "synced" and appends a log entry — no external network
 * call is made.
 */

import { appendAudit, getCurrentActor, getDb, mutate } from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import type {
  MenuChannelListing,
  OjolChannel,
  OjolPlatform,
  OjolSyncLog,
} from "@/types";
import { delay } from "./_latency";
import { http } from "./http";
import { qs } from "./_qs";

/**
 * Mirror the server-side `maskKey()` in `src/server/api/ojol-utils.ts`. The
 * real backend only surfaces the last 4 chars of the API key; the mock DB
 * stores the full value, so we apply the same redaction whenever a channel
 * leaves this module toward the UI.
 */
function maskKey(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.length <= 4) return "••••";
  return `••••${raw.slice(-4)}`;
}

function maskChannel(ch: OjolChannel): OjolChannel {
  return { ...ch, api_key: maskKey(ch.api_key) };
}

// ────────────────────────────────────────────────────────────────────────────
// Channels
// ────────────────────────────────────────────────────────────────────────────

export interface ChannelFilters {
  outlet_id?: string | null;
  platform?: OjolPlatform | null;
}

export async function listChannels(
  filters?: ChannelFilters,
): Promise<OjolChannel[]> {
  if (config.api.useRealBackend) {
    return http.get<OjolChannel[]>(`/api/ojol/channels${qs(filters)}`);
  }
  return delay(
    getDb()
      .ojol_channels.filter((c) => {
        if (filters?.outlet_id && c.outlet_id !== filters.outlet_id)
          return false;
        if (filters?.platform && c.platform !== filters.platform) return false;
        return true;
      })
      .map(maskChannel),
  );
}

export type ChannelUpdateInput = Partial<
  Pick<
    OjolChannel,
    | "store_name"
    | "merchant_id"
    | "api_key"
    | "is_connected"
    | "auto_sync"
    | "notes"
  >
>;

export async function updateChannel(
  id: string,
  input: ChannelUpdateInput,
): Promise<OjolChannel> {
  if (config.api.useRealBackend) {
    return http.patch<OjolChannel>(`/api/ojol/channels/${id}`, input);
  }
  return delay(
    mutate((db) => {
      const ch = db.ojol_channels.find((c) => c.id === id);
      if (!ch) throw new Error("Channel tidak ditemukan");
      Object.assign(ch, input);
      appendAudit(db, {
        action: "update",
        entity: "ojol_channel",
        entity_id: ch.id,
        entity_name: `${ch.platform} — ${ch.store_name}`,
        outlet_id: ch.outlet_id,
      });
      return maskChannel(ch);
    }),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Listings
// ────────────────────────────────────────────────────────────────────────────

export interface ListingFilters {
  menu_id?: string | null;
  platform?: OjolPlatform | null;
}

export async function listListings(
  filters?: ListingFilters,
): Promise<MenuChannelListing[]> {
  if (config.api.useRealBackend) {
    return http.get<MenuChannelListing[]>(`/api/ojol/listings${qs(filters)}`);
  }
  return delay(
    getDb().menu_channel_listings.filter((l) => {
      if (filters?.menu_id && l.menu_id !== filters.menu_id) return false;
      if (filters?.platform && l.platform !== filters.platform) return false;
      return true;
    }),
  );
}

export type ListingUpdateInput = Partial<
  Pick<MenuChannelListing, "price_override" | "is_available">
>;

export async function updateListing(
  id: string,
  input: ListingUpdateInput,
): Promise<MenuChannelListing> {
  if (config.api.useRealBackend) {
    return http.patch<MenuChannelListing>(`/api/ojol/listings/${id}`, input);
  }
  return delay(
    mutate((db) => {
      const row = db.menu_channel_listings.find((l) => l.id === id);
      if (!row) throw new Error("Listing tidak ditemukan");
      Object.assign(row, input);
      // Any edit marks the row as pending re-sync until the Owner hits "Sync".
      row.sync_status = "pending";
      const menu = db.menus.find((m) => m.id === row.menu_id);
      appendAudit(db, {
        action: "update",
        entity: "menu_channel_listing",
        entity_id: row.id,
        entity_name: `${menu?.name ?? row.menu_id} — ${row.platform}`,
      });
      return row;
    }),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sync
// ────────────────────────────────────────────────────────────────────────────

export interface TriggerSyncInput {
  outlet_id: string;
  platform: OjolPlatform;
}

/**
 * Kick off a sync for a given (outlet, platform). In production this is a
 * background job that walks every active menu in the outlet, pushes the
 * merged price + availability to the platform, and updates each listing's
 * `sync_status`. In the mock we just flip statuses synchronously and write
 * a log entry so the UI has something to render.
 */
export async function triggerSync(
  input: TriggerSyncInput,
): Promise<OjolSyncLog> {
  if (config.api.useRealBackend) {
    return http.post<OjolSyncLog>("/api/ojol/sync", input);
  }
  return delay(
    mutate((db) => {
      const channel = db.ojol_channels.find(
        (c) => c.outlet_id === input.outlet_id && c.platform === input.platform,
      );
      if (!channel) throw new Error("Channel tidak ditemukan untuk outlet ini");
      if (!channel.is_connected) throw new Error("Channel belum terhubung");

      const now = new Date().toISOString();
      // Sync every menu that has the outlet in its `outlet_ids`.
      const menuIds = new Set(
        db.menus
          .filter((m) => m.outlet_ids.includes(input.outlet_id) && m.is_active)
          .map((m) => m.id),
      );
      const rows = db.menu_channel_listings.filter(
        (l) => l.platform === input.platform && menuIds.has(l.menu_id),
      );
      for (const r of rows) {
        r.sync_status = "synced";
        r.last_sync_at = now;
        r.sync_error = undefined;
      }
      channel.last_sync_at = now;

      const actor = getCurrentActor();
      const log: OjolSyncLog = {
        id: uid("syl"),
        outlet_id: input.outlet_id,
        platform: input.platform,
        triggered_by_user_id: actor.id,
        triggered_by_name: actor.name,
        started_at: now,
        completed_at: now,
        status: "success",
        items_total: rows.length,
        items_synced: rows.length,
        items_failed: 0,
      };
      db.ojol_sync_logs.push(log);

      appendAudit(db, {
        action: "update",
        entity: "ojol_channel",
        entity_id: channel.id,
        entity_name: `Sync ${input.platform} — ${rows.length} item`,
        outlet_id: channel.outlet_id,
      });

      return log;
    }),
  );
}

export interface SyncLogFilters {
  outlet_id?: string | null;
  platform?: OjolPlatform | null;
  limit?: number;
}

export async function listSyncLogs(
  filters?: SyncLogFilters,
): Promise<OjolSyncLog[]> {
  if (config.api.useRealBackend) {
    return http.get<OjolSyncLog[]>(`/api/ojol/sync-logs${qs(filters)}`);
  }
  const rows = getDb()
    .ojol_sync_logs.filter((l) => {
      if (filters?.outlet_id && l.outlet_id !== filters.outlet_id) return false;
      if (filters?.platform && l.platform !== filters.platform) return false;
      return true;
    })
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
  return delay(filters?.limit ? rows.slice(0, filters.limit) : rows);
}
