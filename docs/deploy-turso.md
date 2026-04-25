# Deployment Guide — Turso (libSQL) + Vercel

Target: deploy ALLEE Backoffice ke Vercel (atau host Node manapun) dengan
database libSQL di Turso. Cocok untuk produksi karena:

- DB managed (no VPS maintenance, auto-backup harian).
- Edge-replicated → low latency dari outlet manapun di Indonesia.
- Tetap kompatibel SQLite — migrasi `drizzle-kit` jalan tanpa diubah.
- Free tier cukup untuk pilot 1–3 outlet.

> Untuk deploy ke VPS dengan SQLite file lokal, lihat
> [`deployment-vps.md`](./deployment-vps.md) — itu jalur lama dan masih
> didukung. Codebase ini auto-detect mode dari env: kalau `TURSO_*` di-set
> → remote Turso, kalau tidak → file lokal.

---

## 1. Buat database Turso

Pasang Turso CLI sekali saja di mesin local kalian:

```bash
# macOS / Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Windows (PowerShell, jalankan as admin sekali, lalu reload terminal)
iwr https://get.tur.so/install.ps1 -useb | iex
```

Login + bikin database:

```bash
turso auth login
turso db create allee-prod --location sin   # sin = Singapore (terdekat ID)
```

Ambil URL + token:

```bash
turso db show allee-prod --url
# → libsql://allee-prod-<org>.turso.io

turso db tokens create allee-prod
# → eyJhbGciOiJFZERTQS...
```

Simpan keduanya — itu `TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN`.

## 2. Generate `BETTER_AUTH_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Pakai output 64-char hex itu sebagai `BETTER_AUTH_SECRET` (rotate aja kalau
bocor — semua session lama otomatis invalid).

## 3. Apply migrations ke Turso

Set env di shell lokal (atau `.env.local`), lalu push schema:

```bash
export TURSO_DATABASE_URL="libsql://allee-prod-<org>.turso.io"
export TURSO_AUTH_TOKEN="eyJhbGciOi..."

# Generate dari schema (skip kalau migrasi di drizzle/ sudah up-to-date).
# npm run db:generate

# Apply ke Turso
npm run db:migrate
```

`drizzle.config.ts` auto-detect `TURSO_*` → switch ke `dialect: "turso"`.

> Verifikasi: `turso db shell allee-prod` lalu `.tables` — harus muncul
> ~30 tabel (`outlets`, `users`, `menus`, `transactions`, ...).

## 4. Seed data demo (opsional, tapi disarankan untuk pilot)

```bash
# Tetap pakai env yang sama, jadi seed langsung tulis ke Turso.
npm run db:seed
```

Catatan timing: setiap insert = 1 HTTP round-trip ke Turso edge. Seed full
~600 row biasanya 60–120 detik. Jangan kaget kalau sempat lama.

Setelah seed selesai, login pakai akun demo:
- `budi@allee.local` (Owner)
- `andi@allee.local` (Kepala Toko Dago)
- `siti@allee.local` (Kepala Toko PIM)
- Password semua: `password`

## 5. Deploy ke Vercel

### a. Push repo ke GitHub

(Standar git — skip kalau sudah.)

### b. Import di Vercel

1. New Project → pilih repo `allee-backoffice`.
2. Framework preset: Next.js (auto-detect).
3. Build command: `npm run build` (default).
4. Output: `.next` (default).

### c. Set environment variables di dashboard Vercel

| Key | Value | Scope |
|---|---|---|
| `TURSO_DATABASE_URL` | `libsql://...turso.io` | Production + Preview |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOi...` | Production + Preview |
| `BETTER_AUTH_SECRET` | (64-char hex dari step 2) | Production + Preview |
| `BETTER_AUTH_URL` | `https://<your-vercel-domain>` | Production |
| `NEXT_PUBLIC_USE_REAL_BACKEND` | `true` | Production + Preview |
| `NEXT_PUBLIC_APP_CHANNEL` | `PROD` | Production |
| (optional) `NEXT_PUBLIC_API_BASE_URL` | kosongkan | — |

> ⚠️ **`BETTER_AUTH_URL` harus persis match origin** yang dipakai user.
> Kalau pakai custom domain (`backoffice.allee.id`), set ke
> `https://backoffice.allee.id`. Mismatch = cookie tidak ke-set / login
> looping.

### d. Trigger first deploy

Klik Deploy. Build harus sukses (no native modules — `@libsql/client`
adalah pure JS untuk mode HTTP).

Setelah deploy:
1. Buka `https://<domain>/login`
2. Login pakai `budi@allee.local` / `password`
3. Verifikasi dashboard, list menu, laporan tampil.

## 6. Hubungkan POS

POS Vercel (`https://allee-pos.vercel.app`) hit endpoint backoffice via:

```
POST https://<backoffice-domain>/api/transactions
Content-Type: application/json
Cookie: <session cookie dari /api/auth/sign-in>
```

Karena POS dan backoffice di domain Vercel yang berbeda, kalau mau session
shared kalian perlu salah satu:

- **Same root domain** — set custom domain `pos.allee.id` + `bo.allee.id`,
  lalu ubah `defaultCookieAttributes` di `src/server/auth/index.ts` ke
  `{ sameSite: "none", secure: true, domain: ".allee.id" }`. Cookie shared.
- **Token-based** — POS minta short-lived token via API, kirim sebagai
  `Authorization: Bearer ...` ke backoffice. Defer sampai PIN-login
  endpoint dibikin (lihat issue di commit `d4386ba`).

Untuk MVP cepat, owner login manual di backoffice → ekspos session ke POS
adalah jalur paling sederhana.

## 7. Pemeliharaan

**Backup:** Turso bikin snapshot otomatis tiap 24 jam (free tier 30 hari
retensi). Untuk on-demand:
```bash
turso db shell allee-prod ".dump" > backup-$(date +%F).sql
```

**Migrasi schema baru:**
1. Edit `src/server/db/schema.ts`.
2. `npm run db:generate` — bikin file SQL baru di `drizzle/`.
3. `npm run db:migrate` — apply ke Turso (env `TURSO_*` masih di-set).
4. Commit + push → Vercel re-deploy otomatis.

**Rollback:** `turso db shell allee-prod` lalu apply SQL down-migration
manual. Drizzle tidak generate down-migration — siapkan rollback script
sendiri kalau migrasi destruktif.

**Monitoring:** Turso dashboard sediakan query log + storage usage.
Vercel sediakan function logs untuk error API. Sentry/LogRocket bisa
ditempel di `src/app/(app)/error.tsx` saat siap.

---

## Troubleshooting

| Gejala | Cek |
|---|---|
| Build gagal `Cannot find module '@libsql/client'` | `npm install` belum dijalankan / lockfile tidak ke-commit. |
| Login looping | `BETTER_AUTH_URL` salah origin, atau cookie `secure=true` tapi akses pakai HTTP. |
| `database is locked` | Tidak akan muncul di Turso (server-managed). Kalau muncul lokal → ada proses lain pegang `data/app.db`. |
| Insert lambat (~5s/row) | Turso region jauh dari host Vercel. Pilih region database `sin` (Singapore) untuk function di `sin1`/`hnd1`. |
| `TURSO_AUTH_TOKEN expired` | Token punya umur ~30 hari default. Generate baru: `turso db tokens create allee-prod --expiration 1y`. |
