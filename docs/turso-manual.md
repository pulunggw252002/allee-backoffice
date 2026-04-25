# Panduan Manual Turso — ALLEE Backoffice

Panduan langkah-demi-langkah dari nol sampai DB Turso siap dipakai produksi.
Cocok kalau kalian belum pernah pakai Turso. Untuk panduan deploy
keseluruhan ke Vercel, lihat [`deploy-turso.md`](./deploy-turso.md) — file
ini fokus ke "gimana cara ngurus database-nya".

---

## 0. Apa itu Turso & kenapa kita pilih

**Turso** = database libSQL (fork SQLite) yang di-host. Dari sisi aplikasi,
behavior sama persis dengan SQLite biasa — file `.db` lokal yang kita pakai
selama development bahkan kompatibel 1:1 dengan Turso. Bedanya: Turso
hosting-nya di cloud, replikasi ke beberapa region, auto-backup.

Kenapa cocok untuk ALLEE Backoffice:

- POS + Backoffice bisa baca-tulis ke DB yang sama tanpa perlu setup
  PostgreSQL/MySQL/server VPS sendiri.
- Free tier-nya generous (500 DB, 9 GB total, 1 milyar row reads/bulan)
  — pilot 1–3 outlet pasti aman.
- Region Singapore (`sin`) latency 30–50 ms dari Indonesia.
- Migration `drizzle-kit` jalan tanpa diubah karena tetap dialek SQLite.
- Tidak ada native module di runtime → build Vercel mulus.

---

## 1. Bikin akun Turso

1. Buka [https://turso.tech](https://turso.tech).
2. Klik **Sign up** → login pakai GitHub atau email.
3. Setelah masuk dashboard, kalian akan diberi satu **organization** default
   (biasanya nama GitHub kalian, contoh: `pulunggw252002`).

> **Catatan free tier:** sudah cukup untuk pilot. Upgrade ke Scaler ($29/mo)
> kalau sudah > 3 outlet aktif atau write-heavy.

---

## 2. Install Turso CLI

CLI dipakai untuk bikin DB, ambil URL, generate token, dan akses shell SQL
langsung. Pilih sesuai OS:

### macOS / Linux

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

Setelah selesai, buka terminal baru lalu cek:

```bash
turso --version
```

### Windows (Powershell, run as admin sekali)

```powershell
iwr https://get.tur.so/install.ps1 -useb | iex
```

Lalu reload terminal. Verifikasi:

```powershell
turso --version
```

Kalau `turso` tidak ke-detect, restart terminal — installer baru saja nambah
PATH.

---

## 3. Login ke Turso dari CLI

```bash
turso auth login
```

Akan buka browser → konfirmasi → balik ke terminal akan keluar:

```
Success! You are now logged in as <username>.
```

Cek:

```bash
turso auth whoami
```

---

## 4. Bikin database

```bash
turso db create allee-prod --location sin
```

Penjelasan flag:
- `allee-prod` — nama DB (silakan ganti, harus unik dalam organization).
- `--location sin` — Singapore. Turso list lokasi via `turso db locations`,
  pilih yang terdekat user (untuk Indonesia, `sin` paling masuk akal).

Output:
```
Created database allee-prod at group default in 1.21s.

Start an interactive SQL shell with:
   turso db shell allee-prod
```

> Kalau mau bikin DB **staging** terpisah:
> `turso db create allee-staging --location sin`

---

## 5. Ambil URL + Auth Token

Aplikasi butuh dua nilai:

```bash
# URL koneksi (libsql://...)
turso db show allee-prod --url
```
Output contoh:
```
libsql://allee-prod-pulunggw252002.turso.io
```

```bash
# Auth token (umur default 7 hari — pakai --expiration untuk lebih lama)
turso db tokens create allee-prod --expiration 1y
```
Output contoh (panjang, JWT):
```
eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQi...
```

**Simpan keduanya** di password manager kalian. Token = kunci akses penuh
ke DB; jangan commit ke git, jangan di-share di chat publik.

> Kalau token bocor: `turso db tokens invalidate allee-prod` lalu generate
> baru. Semua koneksi existing langsung putus.

---

## 6. Set environment variables

### Untuk migrate / seed dari laptop lokal

Buat file `.env.local` di root project (kalau belum ada, copy dari
`.env.example`):

```env
# ... env lain biarkan ...

TURSO_DATABASE_URL="libsql://allee-prod-<org>.turso.io"
TURSO_AUTH_TOKEN="eyJhbGciOi..."

BETTER_AUTH_SECRET="64-char-hex-string"
BETTER_AUTH_URL="http://localhost:3000"
```

> Cara generate `BETTER_AUTH_SECRET`:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

> Logika di `src/server/db/client.ts`: kalau `TURSO_DATABASE_URL` ke-set,
> dia menang dari `DATABASE_URL`. Jadi env lokal kalian bisa simultan
> punya dua-duanya — komen out yang satu tergantung mau test mode mana.

### Untuk Vercel (production)

Dashboard Vercel → Project Settings → Environment Variables, tambahkan:

| Key | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://...turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJ...` |
| `BETTER_AUTH_SECRET` | (64-char hex) |
| `BETTER_AUTH_URL` | `https://<your-vercel-domain>` |
| `NEXT_PUBLIC_USE_REAL_BACKEND` | `true` |

Apply ke scope **Production** (dan **Preview** kalau mau preview deploy
juga konek). Setelah di-set, redeploy supaya env baru terbaca.

---

## 7. Apply schema (migrate)

Schema didefinisikan di `src/server/db/schema.ts`. File migrasi SQL
ter-generate sudah ada di `drizzle/`.

```bash
npm run db:migrate
```

Apa yang terjadi:
1. `drizzle.config.ts` baca `TURSO_DATABASE_URL` dari env.
2. Karena ke-set, switch ke `dialect: "turso"`.
3. Apply file `drizzle/0000_init.sql` → `drizzle/0001_certain_dragon_man.sql`
   ke Turso secara berurutan.
4. Tabel `__drizzle_migrations` di-create otomatis untuk tracking.

Verifikasi sukses:

```bash
turso db shell allee-prod
```

Lalu di shell:

```
.tables
```

Harus muncul ~30 tabel: `outlets`, `users`, `menus`, `transactions`,
`transaction_items`, `transaction_item_addons`, dll.

Keluar dari shell: `.quit`

---

## 8. Seed data demo (opsional, sangat disarankan untuk pilot)

```bash
npm run db:seed
```

Akan:
1. Truncate semua tabel (atomic via `client.batch()`).
2. Insert 2 outlet, 7 user (1 owner + 2 kepala toko + 4 staff), 20+ bahan,
   10+ menu, ~30 transaksi 7 hari terakhir, audit logs, attendance, dll.
3. Bikin 7 identitas Better Auth (`<nama>@allee.local` / password
   `password`).

> ⏱️ **Timing:** setiap insert = 1 HTTP round-trip ke Turso edge. Seed full
> ~600 row biasanya **60–120 detik**. Jangan kaget, jangan di-cancel.
> Lokal file mode sebaliknya selesai dalam ~2 detik.

Setelah selesai, login uji coba:
- Email: `budi@allee.local` (Owner) / `andi@allee.local` (Kepala Toko Dago)
- Password: `password`

---

## 9. Verifikasi via Turso shell

```bash
turso db shell allee-prod
```

Beberapa query verifikasi yang berguna:

```sql
-- Hitung total per tabel utama
SELECT 'outlets' as tbl, COUNT(*) FROM outlets
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'menus', COUNT(*) FROM menus
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions;

-- Cek user Better Auth ada
SELECT email, domain_user_id FROM user_auth;

-- Sample transaksi terbaru
SELECT id, outlet_id, grand_total, payment_method, created_at
FROM transactions ORDER BY created_at DESC LIMIT 5;
```

---

## 10. Operasi sehari-hari

### a. Lihat ukuran DB

```bash
turso db inspect allee-prod
```

Output: row count per tabel, total size, replikasi info.

### b. Backup manual

Turso bikin snapshot otomatis tiap 24 jam (free tier 30 hari retensi).
Untuk backup on-demand sebagai file `.sql`:

```bash
turso db shell allee-prod ".dump" > backup-$(date +%F).sql
```

> Restore dari backup ke DB baru:
> ```bash
> turso db create allee-restore --location sin
> turso db shell allee-restore < backup-2026-04-25.sql
> ```

### c. Monitor query

Dashboard Turso → pilih DB → tab **Stats**. Ada chart untuk:
- Read/write rows per hari
- Storage usage
- Active connections

### d. Generate token baru (rotasi)

Setiap 6–12 bulan, atau setelah kecurigaan bocor:

```bash
# Bikin token baru
turso db tokens create allee-prod --expiration 1y

# Update env di Vercel + redeploy

# Setelah dipastikan token baru jalan, invalidate semua token lama
turso db tokens invalidate allee-prod
```

`invalidate` memutus **semua** koneksi yang masih pakai token lama —
pastikan token baru sudah live di Vercel sebelum eksekusi.

### e. Apply migrasi schema baru

Setelah edit `src/server/db/schema.ts`:

```bash
# 1. Generate file SQL migrasi baru
npm run db:generate

# 2. Review file baru di drizzle/000X_*.sql — pastikan tidak ada DROP
#    yang tidak diniat (drizzle-kit kadang detect rename sebagai drop+create).

# 3. Apply ke Turso
npm run db:migrate

# 4. Commit drizzle/000X_*.sql + drizzle/meta/_journal.json ke git
```

### f. Hapus DB (HATI-HATI, tidak bisa di-undo)

```bash
turso db destroy allee-prod
```

Akan minta konfirmasi nama DB. Backup dulu kalau ragu.

---

## 11. Troubleshooting

| Gejala | Cek |
|---|---|
| `Error: Authentication required` saat migrate | `TURSO_AUTH_TOKEN` salah / kosong / expired. Generate baru. |
| `LIBSQL_INVALID_DATABASE_URL` | URL salah format, harus mulai `libsql://`. Bukan `https://`. |
| Migrate `table already exists` | Sudah pernah di-migrate. Skip — drizzle-kit normalnya idempotent, kecuali tabel `__drizzle_migrations` dihapus manual. |
| Seed gagal di tengah | Re-run aja — `npm run db:seed` truncate dulu sebelum insert. |
| Login backoffice "Invalid credentials" padahal seed sukses | `BETTER_AUTH_URL` di Vercel tidak match origin browser. Set persis sama. |
| Insert lambat (~5 s/row) | Region DB jauh dari host Vercel. Pastikan DB di `sin` dan Vercel function di `sin1`/`hnd1` (default Vercel auto-pilih nearest). |
| `turso db shell` query lambat | Latency CLI ke Singapore ~50 ms tiap query, normal. Untuk batch query gede pakai `.dump` ke file lalu proses lokal. |
| `database is locked` di Turso | Tidak akan muncul (server-managed). Kalau muncul → kemungkinan client lokal kalian masih konek ke file `data/app.db` (cek `TURSO_DATABASE_URL` ke-set atau tidak). |

---

## 12. Cheat sheet command

```bash
# Setup awal
turso auth login
turso db create allee-prod --location sin

# Ambil credential
turso db show allee-prod --url
turso db tokens create allee-prod --expiration 1y

# Operasi
turso db list                            # list semua DB
turso db inspect allee-prod              # info ukuran + row count
turso db shell allee-prod                # SQL shell interaktif
turso db shell allee-prod ".tables"      # one-shot command
turso db shell allee-prod ".dump" > b.sql  # backup
turso db destroy allee-prod              # hapus (irreversible)

# Token
turso db tokens create allee-prod
turso db tokens invalidate allee-prod    # putus semua token lama

# Workspace
turso plan show                          # quota saat ini
turso db locations                       # list semua region
```

---

## 13. Checklist sebelum go-live

- [ ] DB `allee-prod` di region `sin`
- [ ] `TURSO_AUTH_TOKEN` durasi minimal 1 tahun
- [ ] Migrate sukses → `.tables` di shell tampil ~30 tabel
- [ ] Seed sukses (atau owner pertama dibikin manual lewat UI lain)
- [ ] Env `TURSO_*` ter-set di Vercel scope **Production**
- [ ] `BETTER_AUTH_SECRET` 64 hex char di Vercel
- [ ] `BETTER_AUTH_URL` persis match origin produksi (https://)
- [ ] `NEXT_PUBLIC_USE_REAL_BACKEND=true` di Vercel
- [ ] Login pakai akun owner di `https://<domain>/login` berhasil
- [ ] Halaman dashboard menampilkan KPI (revenue, transaksi)
- [ ] Backup pertama dilakukan (`.dump` ke file aman)
- [ ] Token disimpan di password manager tim, **tidak di repo git**

Selesai → siap operasional.
