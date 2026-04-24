# ALLEE Backoffice

Web backoffice untuk sistem POS ALLEE — kelola menu, resep, inventory, outlet,
user, integrasi ojol, dan reporting. Frontend: Next.js 15 (App Router) +
TypeScript. Backend: Next.js API routes + Drizzle ORM + better-sqlite3 +
Better Auth.

Backoffice ini di-pair dengan aplikasi POS ALLEE (terpisah). Keduanya berbagi
SQLite DB yang sama lewat `DATABASE_URL`, sehingga staff bisa login ke POS
pakai PIN yang di-set Owner di sini, dan transaksi di POS langsung muncul di
dashboard backoffice tanpa sync layer tambahan.

## Stack

| Lapis | Pilihan |
|---|---|
| Framework | Next.js 15 + App Router + TypeScript strict |
| UI | Tailwind v4 + shadcn/ui + lucide-react + sonner |
| Data fetching | TanStack Query |
| Forms | react-hook-form + zod |
| Auth | Better Auth (email + password, sign-up off) |
| DB | better-sqlite3 + Drizzle ORM (migrations di `drizzle/`) |
| Charts | Recharts |
| State | Zustand (auth + outlet selector) |

## Quick start

Prasyarat: Node 20+, npm 10+, Windows/macOS/Linux.

```bash
# 1. install
npm install

# 2. siapkan .env.local
cp .env.example .env.local
#    edit .env.local — minimal isi BETTER_AUTH_SECRET dengan 32+ char random:
#    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. siapkan database
npm run db:migrate     # apply schema
npm run db:seed        # isi 2 outlet, 7 user, 10+ menu, transaksi demo, dll.

# 4. jalankan
npm run dev            # http://localhost:3000
```

Login demo (password sama untuk semua: `password`):

| Nama | Role | Email login | Akses |
|---|---|---|---|
| Budi | Owner | `budi@allee.local` | Full access |
| Andi | Kepala Toko Dago | `andi@allee.local` | Outlet Dago saja |
| Siti | Kepala Toko PIM | `siti@allee.local` | Outlet PIM saja |
| Rudi Kasir | Kasir | `rudi.kasir@allee.local` | POS only (tidak bisa masuk backoffice) |

## Modul

- **Dashboard** — KPI revenue/profit/HPP, chart 7 hari, top menu, low-stock.
- **Menu** — CRUD menu + recipe builder dengan HPP realtime; add-on group +
  modifier; bundling; diskon (percent/nominal, scope per kategori/menu, jadwal
  jam aktif).
- **Inventory** — bahan per outlet, stock-in, stock-out (waste/sale/adjust),
  stock opname dengan diff approval.
- **Users** — Owner CRUD staff + set/clear PIN POS (di-hash scrypt).
- **Outlets** — Owner CRUD outlet.
- **Reports** — Sales (daily/hourly/weekly/monthly), profit, void, waste,
  inventory value, transaction list. Filter outlet + date range; export CSV.
- **Integrations → Ojol** — per-outlet × per-platform channel config
  (GoFood/GrabFood/ShopeeFood) + per-menu × per-platform price override &
  availability + sync log + audit trail.
- **Settings** — pajak (PPN/Service Charge), attendance cutoff, sales target.
- **Attendance + Audit** — staff check-in/out dengan checklist station,
  history audit log per entitas.

## RBAC ringkas

| Role | Akses |
|---|---|
| Owner | Semua modul, semua outlet |
| Kepala Toko | Inventory + dashboard outlet sendiri (tidak bisa CRUD outlet/user) |
| Kasir/Barista/Kitchen/Waiters | Tidak bisa masuk backoffice — login akan ditolak. Mereka pakai POS. |

Detail lihat `src/lib/rbac.ts` dan guard di `src/app/(app)/layout.tsx`.

## Integrasi dengan POS ALLEE

POS app (terpisah) terkoneksi ke DB SQLite yang sama. Beberapa hal yang
perlu di-coordinate:

1. **Shared DB file** — set `DATABASE_URL` POS dan backoffice ke file SQLite
   yang sama (mis. `/var/lib/allee/app.db` di VPS produksi).
2. **POS PIN** — staff login POS pakai PIN 4–6 digit yang di-set Owner via
   backoffice (`Users → Set PIN`). Hash di-validate via Better Auth scrypt.
   Lihat `src/app/api/users/[id]/pos-pin/route.ts`.
3. **Better Auth context** — POS dan backoffice bisa share `user_auth` /
   `account` table; password hashing identik. Set `BETTER_AUTH_SECRET` yang
   sama di kedua app jika kamu ingin session token saling kompatibel
   (opsional — POS biasanya pakai PIN flow tersendiri lewat
   `pos_pin_hash`).
4. **Schema source of truth** — `drizzle/` migration di repo ini adalah
   master. POS sebaiknya import schema dari npm package internal atau ikut
   migration journal-nya (`drizzle/meta/_journal.json`).
5. **Ojol pricing/availability** — POS membaca `menu_channel_listings`
   untuk tahu harga & status item per platform saat order datang via
   webhook ojol. Backoffice menyimpan price override + flips
   `sync_status='pending'` setiap edit; POS / job sync mendorong perubahan
   itu ke platform.
6. **Audit log** — `audit_logs` table dipakai dua arah: backoffice mencatat
   setiap mutation Owner; POS sebaiknya juga append ke table ini untuk
   transaksi void, refund, manual override harga, dll.

## Variabel lingkungan

Lihat `.env.example` untuk daftar lengkap. Yang wajib di-set di production:

```
DATABASE_URL=/path/ke/app.db        # absolut di VPS
BETTER_AUTH_SECRET=<32+ char random>
BETTER_AUTH_URL=https://<your-domain>
NEXT_PUBLIC_USE_REAL_BACKEND=true
```

`NEXT_PUBLIC_USE_REAL_BACKEND=false` membuat seluruh data layer pakai mock
in-memory (untuk dev UI tanpa DB). Saat `true`, semua call lewat
`/api/*` route handler yang baca DB asli.

## Scripts

```
npm run dev         # next dev (http://localhost:3000)
npm run build       # production build
npm run start       # serve production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run db:generate # drizzle-kit generate (setelah ubah schema.ts)
npm run db:migrate  # apply pending migrations
npm run db:push     # push tanpa migration file (dev only)
npm run db:studio   # drizzle-kit studio UI
npm run db:seed     # isi DB dengan demo data
```

## Struktur folder

```
src/
├── app/
│   ├── (app)/                 # halaman terlindungi (sidebar + RBAC guard)
│   ├── (auth)/login/          # halaman login
│   ├── api/                   # route handlers — dipanggil saat USE_REAL_BACKEND=true
│   └── layout.tsx             # root: theme, providers, font
├── components/
│   ├── ui/                    # shadcn primitives
│   ├── layout/                # sidebar, header, outlet switcher
│   └── <module>/              # form/dialog spesifik modul
├── lib/
│   ├── api/                   # dispatch layer mock ↔ real backend
│   ├── hooks/                 # TanStack Query wrappers
│   ├── mock/                  # in-memory DB + seed (dipakai saat USE_REAL_BACKEND=false)
│   ├── rbac.ts                # role × resource matrix
│   ├── hpp.ts                 # kalkulasi HPP menu/bundle
│   └── format.ts              # formatIDR, formatDate, dll.
├── server/
│   ├── api/                   # helper handle/readJson/audit
│   ├── auth/                  # Better Auth config + session
│   └── db/                    # drizzle client + schema
├── stores/                    # Zustand: auth-store, outlet-store
└── types/                     # domain types (sumber kebenaran)

drizzle/                       # migration files + meta
scripts/seed.ts                # entry point `npm run db:seed`
```

## Seed data dummy

`npm run db:seed` mengisi:

- 2 outlet (`out_dago` Bandung, `out_pim` Jakarta)
- 7 user lintas role (1 Owner, 2 Kepala Toko, 4 staff POS)
- 10+ menu (kopi, makanan), 20+ bahan, add-on group, bundle, diskon
- ~3.600 transaksi terdistribusi 12 bulan terakhir
- 6 ojol channel + 30 listing per menu × platform

Aman untuk di-rerun — semua tabel di-truncate dulu di dalam satu transaksi.

## Lisensi

Internal — proprietary ALLEE.
