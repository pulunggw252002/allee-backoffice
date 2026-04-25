import { appendAudit, diffChanges, getDb, mutate } from "@/lib/mock/db";
import { uid } from "@/lib/utils";
import { config } from "@/lib/config";
import { emailFromName } from "@/lib/auth-email";
import type { User } from "@/types";
import { delay } from "./_latency";
import { http } from "./http";

/**
 * Mirror the server-side `maskPin()` helper. The real backend strips the
 * scrypt hash and surfaces `pos_pin` as `"***" | null`. The mock layer
 * stores the PIN plaintext for local dev, so we apply the same redaction
 * here — otherwise a UI ported between mock and real mode would leak
 * the raw PIN when talking to the mock.
 */
function maskPin(user: User): User {
  return { ...user, pos_pin: user.pos_pin ? "***" : null };
}

export async function list(): Promise<User[]> {
  if (config.api.useRealBackend) {
    return http.get<User[]>("/api/users");
  }
  return delay(getDb().users.map(maskPin));
}

export async function get(id: string): Promise<User | undefined> {
  if (config.api.useRealBackend) {
    return http.get<User>(`/api/users/${id}`);
  }
  const found = getDb().users.find((u) => u.id === id);
  return delay(found ? maskPin(found) : undefined);
}

/**
 * Sign the user in.
 * - Real backend: calls Better Auth's `/api/auth/sign-in/email` with the
 *   synthetic `<slug>@allee.local` email, then hydrates the domain user via
 *   `/api/session`.
 * - Mock: looks up by name+password in the in-memory DB.
 *
 * Returns `null` when credentials are invalid or the account is disabled.
 */
export async function authenticate(
  name: string,
  password: string,
): Promise<User | null> {
  if (config.api.useRealBackend) {
    try {
      const email = emailFromName(name);
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return null;
      // `/api/session` returns a flat subset of User; cast through unknown.
      const session = (await http.get<unknown>("/api/session")) as
        | (Partial<User> & { id: string; name: string; role: User["role"] })
        | null;
      if (!session || !session.id) return null;
      // Hydrate the rest of the User shape from `/api/users/:id` so the auth
      // store has the full record (photo_url, joined_at, is_active, etc.).
      try {
        return await http.get<User>(`/api/users/${session.id}`);
      } catch {
        // Fallback: fabricate a minimal User from the session payload.
        return {
          id: session.id,
          name: session.name,
          role: session.role,
          outlet_id: session.outlet_id ?? null,
          password: "",
          is_active: true,
          joined_at: new Date().toISOString().slice(0, 10),
        } as User;
      }
    } catch {
      return null;
    }
  }
  const db = getDb();
  const user = db.users.find(
    (u) =>
      u.name.toLowerCase() === name.trim().toLowerCase() &&
      u.password === password &&
      u.is_active,
  );
  if (user) {
    mutate((d) => {
      appendAudit(d, {
        action: "login",
        entity: "session",
        entity_id: user.id,
        entity_name: user.name,
        outlet_id: user.outlet_id ?? null,
        actor: { id: user.id, name: user.name, role: user.role },
      });
    });
  }
  // Redact the PIN before handing the record to the auth store so parity
  // with the real-backend path (/api/users/:id is masked) is preserved.
  return delay(user ? maskPin(user) : null);
}

export async function logout(): Promise<void> {
  if (config.api.useRealBackend) {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore — client-side logout will still clear local state */
    }
  }
}

export type UserInput = Omit<User, "id" | "joined_at">;

export async function create(input: UserInput): Promise<User> {
  if (config.api.useRealBackend) {
    return http.post<User>("/api/users", input);
  }
  return delay(
    mutate((db) => {
      if (
        db.users.some(
          (u) => u.name.toLowerCase() === input.name.toLowerCase(),
        )
      ) {
        throw new Error("Nama sudah dipakai user lain");
      }
      const user: User = {
        ...input,
        id: uid("usr"),
        joined_at: new Date().toISOString().slice(0, 10),
      };
      db.users.push(user);
      appendAudit(db, {
        action: "create",
        entity: "user",
        entity_id: user.id,
        entity_name: user.name,
        outlet_id: user.outlet_id ?? null,
      });
      return maskPin(user);
    }),
  );
}

export async function update(id: string, input: Partial<UserInput>) {
  if (config.api.useRealBackend) {
    return http.patch<User>(`/api/users/${id}`, input);
  }
  return delay(
    mutate((db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) throw new Error("User tidak ditemukan");
      if (
        input.name &&
        db.users.some(
          (u) =>
            u.id !== id &&
            u.name.toLowerCase() === input.name!.toLowerCase(),
        )
      ) {
        throw new Error("Nama sudah dipakai user lain");
      }
      const before = { ...user };
      Object.assign(user, input);
      appendAudit(db, {
        action: "update",
        entity: "user",
        entity_id: user.id,
        entity_name: user.name,
        outlet_id: user.outlet_id ?? null,
        changes: diffChanges(
          before as unknown as Record<string, unknown>,
          user as unknown as Record<string, unknown>,
        ),
      });
      return maskPin(user);
    }),
  );
}

/**
 * Set or clear the 4-6 digit numeric PIN a staff member uses to log in to the
 * POS app. Passing `null` clears the PIN (revokes POS access). Owner-only.
 * In mock mode we store plain-text; the real backend hashes before persist.
 */
export async function setPosPin(id: string, pin: string | null): Promise<User> {
  if (config.api.useRealBackend) {
    return http.put<User>(`/api/users/${id}/pos-pin`, { pin });
  }
  return delay(
    mutate((db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) throw new Error("User tidak ditemukan");
      if (pin !== null) {
        if (!/^\d{4,6}$/.test(pin)) {
          throw new Error("PIN harus 4-6 digit angka");
        }
      }
      user.pos_pin = pin;
      appendAudit(db, {
        action: "update",
        entity: "pos_pin",
        entity_id: user.id,
        entity_name: user.name,
        outlet_id: user.outlet_id ?? null,
        notes: pin === null ? "PIN POS dihapus" : "PIN POS diperbarui",
      });
      return maskPin(user);
    }),
  );
}

export async function remove(id: string) {
  if (config.api.useRealBackend) {
    await http.del<{ ok: true }>(`/api/users/${id}`);
    return;
  }
  return delay(
    mutate((db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) throw new Error("User tidak ditemukan");
      user.is_active = false;
      appendAudit(db, {
        action: "delete",
        entity: "user",
        entity_id: user.id,
        entity_name: user.name,
        outlet_id: user.outlet_id ?? null,
        notes: "User dinonaktifkan",
      });
    }),
  );
}
