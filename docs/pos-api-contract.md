# POS ↔ Backoffice API Contract

**Status:** Draft v1 (2026-04-25)
**Audience:** Tim engineering aplikasi POS ALLEE.
**Source of truth:** Backoffice ALLEE (`https://allee-backoffice.vercel.app`).

> Backoffice adalah master data. POS hanya **membaca** master (menu, outlet,
> add-on, bundle, diskon, bahan, pajak, user) dan **menulis kembali** transaksi
> penjualan + void. Semua mutasi katalog/HPP/stok awal dilakukan di Backoffice.

---

## 1. Konvensi Umum

### Base URL
- Production : `https://allee-backoffice.vercel.app/api`
- Preview    : `https://<branch>-allee-backoffice-<team>.vercel.app/api`
- Local dev  : `http://localhost:3000/api`

POS menyimpan base URL di env config-nya (mis. `NEXT_PUBLIC_BACKOFFICE_API_URL`).

### Format
- Request & response body: `application/json; charset=utf-8`.
- Date/time: ISO-8601 UTC string (mis. `2026-04-25T03:14:07.123Z`).
- Currency: integer Rupiah (tanpa desimal, tanpa pemisah ribuan). `12000` = Rp 12.000.
- Quantity bahan: number (boleh desimal — gram, ml, dll mengikuti `ingredient.unit`).
- ID: string opaque, prefix-based (`mnu_*`, `out_*`, `tx_*`, …). Treat as opaque.

### Error shape
Semua error route mengembalikan body:
```json
{ "error": "human readable message", "details": <optional> }
```
| HTTP | Penyebab khas                                                        |
|------|----------------------------------------------------------------------|
| 400  | Validasi Zod gagal / cross-check subtotal mismatch / outlet mismatch |
| 401  | Belum login (cookie tidak ada / session expired)                     |
| 403  | Role tidak punya akses (mis. waiter coba POST `/transactions`)        |
| 404  | Resource tidak ditemukan (atau outlet di luar scope, untuk privacy)  |
| 500  | Bug server — `error` berisi pesan exception                          |

### Versioning
Belum ada path-prefix versi. Saat breaking change, kirim header
`X-API-Version: 2` (default `1`) — server akan branch handler. Sampai itu
diperlukan, POS aman tanpa header ini.

---

## 2. Autentikasi

Backoffice memakai [Better Auth](https://www.better-auth.com) dengan adapter
Drizzle. Cookie session bernama `allee.session_token`, `sameSite=lax`,
`secure` di production. Lihat `src/server/auth/index.ts` untuk konfigurasi.

### 2.1. Sign-in (recommended untuk MVP)
POS men-store `email` + `password` kasir di secure storage device-nya, lalu:

```http
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "rudi-kasir-a3f1@allee.local",
  "password": "<plain text>"
}
```
- 200 → `Set-Cookie: allee.session_token=...`. Simpan + kirim balik di setiap
  request berikutnya (`credentials: "include"` kalau cross-origin, atau
  manual cookie jar di runtime non-browser).
- 401 → email/password salah.

Email staff dibentuk di backoffice saat user dibuat:
`<slug(name)>-<id-suffix>@allee.local` (lihat `src/app/api/users/route.ts:59`).
Owner mendapat email itu dari halaman User di backoffice — mereka yang
bertanggung jawab membagikan kredensial ke device POS.

### 2.2. PIN-based POS login (gap, belum diimplementasi)
Kolom `users.pos_pin_hash` sudah ada (di-set lewat
`PUT /api/users/:id/pos-pin`, owner-only) tapi belum ada endpoint yang
menukar PIN jadi session. Sebelum endpoint itu dibuat, POS pakai jalur 2.1.

**Saran roadmap:** tambah `POST /api/auth/pos-pin` dengan body
`{ outlet_id, pin }` → cari user di outlet itu yang `pos_pin_hash` cocok,
lalu issue session via `auth.api.signIn` internal. Beri rate-limit per IP
(brute-force PIN 4 digit cuma 10k kombinasi).

**Seed bootstrap:** `npm run db:seed` sekarang men-generate random 4-digit
PIN per user dan print plaintext-nya di console output (lihat sample log
di bagian akhir log). PIN ini cuma untuk smoke-test POS app — owner harus
rotate via UI Backoffice → Users → "Edit PIN POS" sebelum produksi. PIN
plaintext **tidak** disimpan di mana pun selain log run seed.

### 2.3. Sign-out
```http
POST /api/auth/sign-out
```
Backend menghapus row `session` + clear cookie.

### 2.4. Get current session (POS hydration)
```http
GET /api/session
```
Response 200:
```json
{
  "id": "usr_xxx",
  "name": "Rudi",
  "role": "kasir",
  "outlet_id": "out_dago",
  "email": "rudi-kasir-a3f1@allee.local"
}
```
401 kalau belum login. POS pakai ini setelah sign-in untuk tahu outlet
default + role-nya.

### 2.5. Cross-origin caveat
Kalau POS dideploy di domain berbeda (mis. `allee-pos.vercel.app`), cookie
`sameSite=lax` **tidak** akan dikirim oleh browser. Dua opsi:

1. **Custom domain shared root** (preferred): POS di `pos.allee.id`,
   Backoffice di `app.allee.id`, set `BETTER_AUTH_URL=https://app.allee.id`
   dan cookie domain `.allee.id` di backoffice.
2. **Token-based**: tambah handler yang trade session jadi bearer token
   pendek (TTL 1 jam), POS kirim `Authorization: Bearer <token>`. Belum
   ada — perlu PR.

Untuk runtime non-browser (mobile/desktop native) cukup forward `Cookie`
header manual; CORS tidak menghalangi.

---

## 3. Read Endpoints — Master Data dari Backoffice

Semua endpoint bagian ini butuh session (401 kalau tidak). Field hasil
sudah cocok dengan TypeScript types di `src/types/index.ts` — POS
disarankan generate types dari OpenAPI atau copy file types itu.

### 3.1. `GET /api/outlets`
List outlet aktif.
```json
[
  {
    "id": "out_dago",
    "name": "ALLEE Dago",
    "address": "Jl. Ir. H. Juanda 123",
    "city": "Bandung",
    "phone": "+62...",
    "opening_hours": "08:00–22:00",
    "is_active": true,
    "created_at": "2026-01-01T00:00:00.000Z"
  }
]
```
Owner dapat semua outlet; non-owner dapat outlet sendiri saja.

### 3.2. `GET /api/menus`
List menu dengan relasi sudah di-hydrate dalam 3 round-trip total
(bukan 3×N). Field penting untuk POS:
```json
[
  {
    "id": "mnu_ice_latte",
    "category_id": "cat_drinks",
    "name": "Ice Latte",
    "sku": "ICE-LAT-001",
    "price": 28000,
    "hpp_cached": 9500,
    "photo_url": "https://...",
    "description": "...",
    "type": "regular",
    "is_active": true,
    "outlet_ids": ["out_dago", "out_pim"],
    "recipes": [
      { "id": "rec_xxx", "menu_id": "mnu_ice_latte",
        "ingredient_id": "ing_espresso", "quantity": 30, "notes": null }
    ],
    "addon_group_ids": ["ag_sugar", "ag_ice", "ag_extra_shot"]
  }
]
```
- POS filter `outlet_ids.includes(myOutlet)` untuk munculkan menu yang
  tersedia di outlet itu.
- `recipes` hanya dipakai POS untuk preview HPP / debug — server tetap
  re-deduct stok saat `POST /transactions`.

### 3.3. `GET /api/menus/:id`
Single menu, shape sama dengan list di atas (plus tidak ada array wrap).
404 kalau id tidak ada.

### 3.4. `GET /api/categories`
Kategori menu (untuk POS group/grid):
```json
[ { "id": "cat_drinks", "name": "Minuman", "sort_order": 1 } ]
```

### 3.5. `GET /api/addon-groups`
Group + nested options + per-option recipe modifier:
```json
[
  {
    "id": "ag_sugar",
    "name": "Sugar Level",
    "selection_type": "single",
    "is_required": true,
    "options": [
      {
        "id": "ao_sugar_normal",
        "addon_group_id": "ag_sugar",
        "name": "Normal",
        "extra_price": 0,
        "modifiers": [
          { "id": "mod_xxx", "addon_option_id": "ao_sugar_normal",
            "ingredient_id": "ing_gula", "quantity_delta": 10, "mode": "delta" }
        ]
      }
    ]
  }
]
```
POS perlu `selection_type` (`single`/`multi`) + `is_required` untuk
validasi UI cart sebelum submit.

### 3.6. `GET /api/bundles`
Bundling (paket hemat):
```json
[
  {
    "id": "bnd_paket_hemat",
    "name": "Paket Hemat",
    "price": 35000,
    "is_active": true,
    "outlet_ids": ["out_dago", "out_pim"],
    "items": [ { "bundle_id": "bnd_paket_hemat",
                 "menu_id": "mnu_nasi_goreng", "quantity": 1 } ]
  }
]
```
Saat POS jual bundle, kirim item dengan `bundle_id` (bukan `menu_id`) —
lihat 4.1.

### 3.7. `GET /api/discounts`
Daftar diskon aktif (POS apply client-side):
```json
[
  {
    "id": "dsc_happy_hour",
    "name": "Happy Hour",
    "type": "percent",          // atau "nominal"
    "value": 20,                 // 20 persen, atau 2000 (IDR) untuk nominal
    "scope": "category",         // "all" | "category" | "menu"
    "scope_ref_id": "cat_drinks",
    "active_hour_start": "14:00",
    "active_hour_end": "17:00",
    "is_active": true
  }
]
```
POS tanggung-jawab cek waktu/scope; `discount_total` dikirim sudah
terhitung saat `POST /transactions`.

### 3.8. `GET /api/ingredients`
Bahan + stok per outlet:
```json
[
  {
    "id": "ing_espresso",
    "outlet_id": "out_dago",
    "name": "Espresso",
    "unit": "ml",
    "unit_price": 50,
    "current_stock": 1200,
    "min_qty": 200,
    "storage_location": "Bar",
    "updated_at": "2026-04-24T..."
  }
]
```
Kasir/kepala_toko hanya dapat row outlet sendiri. POS bisa pakai untuk
overlay "stok rendah" atau hard-block jual menu yang stok bahannya 0
(opsional — server tidak menolak penjualan; stok bisa minus).

### 3.9. `GET /api/tax-settings`
Singleton:
```json
{ "ppn_percent": 11, "service_charge_percent": 5,
  "updated_at": "2026-04-01T..." }
```
POS hitung `ppn_amount` & `service_charge_amount` sendiri (`subtotal *
percent / 100`, dibulatkan ke integer rupiah) lalu kirim di body
`POST /transactions`. Server tidak meng-override.

### 3.10. `GET /api/users`
Daftar staff (owner: semua; non-owner: outlet sendiri). POS pakai untuk
PIN-login UI ("pilih nama → masukkan PIN") — meski tahap 1 sign-in pakai
email+password, daftar nama tetap berguna untuk shift/clock-in.
Field `pos_pin_hash` di-redact menjadi `pos_pin: "***"` atau `null`.

---

## 4. Write Endpoints — POS → Backoffice

### 4.1. `POST /api/transactions`  (utama)
Idempotent: POS men-generate `id` lokal (mis. `tx_<uuid>`) dan kirim ke
server. Re-POST dengan `id` sama mengembalikan transaksi existing tanpa
double-create — sehingga retry on network failure aman.

**Roles:** owner / kepala_toko / kasir.
**Scope:** `outlet_id` di body harus sama dengan `outlet_id` user (kecuali owner).

Body penuh:
```json
{
  "id": "tx_01HZX7Y8PQR1ABCDEFG",       // POS-generated, idempotency key
  "outlet_id": "out_dago",
  "payment_method": "cash",              // "cash" | "qris" | "card" | "transfer"
  "order_type": "dine_in",               // "dine_in" | "take_away" | "delivery" | "online"
  "status": "paid",                      // default "paid"; "open" untuk simpan-tahan
  "subtotal": 56000,                     // Σ items (server cross-check, tol 1 IDR)
  "discount_total": 5000,
  "ppn_amount": 6160,
  "service_charge_amount": 2800,
  "grand_total": 59960,
  "created_at": "2026-04-25T10:30:00.000Z",  // optional; default nowIso()
  "items": [
    {
      "menu_id": "mnu_ice_latte",        // tepat satu dari menu_id ATAU bundle_id
      "bundle_id": null,
      "name_snapshot": "Ice Latte",      // simpan nama saat dijual (immutable)
      "quantity": 2,
      "unit_price": 28000,               // snapshot harga saat dijual
      "hpp_snapshot": 9500,              // snapshot HPP — server tidak hitung ulang
      "subtotal": 56000,                 // (unit_price + Σ addon.extra_price) * qty
      "addons": [
        {
          "addon_option_id": "ao_sugar_normal",
          "name_snapshot": "Normal",
          "extra_price": 0
        }
      ]
    }
  ]
}
```

**Validasi server (lihat `src/app/api/transactions/route.ts`):**
1. Tepat satu dari `menu_id` / `bundle_id` per item.
2. Outlet existence + user-scope match.
3. Recompute subtotal: `Σ (unit_price + Σ addon.extra_price) * quantity`,
   harus dalam `±1 IDR` dari `subtotal` body. Drift > 1 → 400.
4. `quantity` integer positif; semua amount nonnegative.

**Side effects (atomic in single transaction):**
- Insert `transactions` + `transaction_items` + `transaction_item_addons`.
- Untuk setiap item dengan `menu_id`: deduct `ingredients.current_stock`
  berdasar `recipe_items.quantity * item.quantity`, scoped ke
  `ingredients.outlet_id == outlet_id`.
- Addon modifier mode `delta`: tambah ke deduction. Mode `override`:
  saat ini di-skip (dilewati untuk MVP).
- Insert `stock_movements` (type `out_sale`) per ingredient yang ke-deduct.
- Audit log entry.

**Response 200 (created baru atau idempotent hit):**
Shape sama dengan `GET /api/transactions/:id` — full transaction + items
+ addons. POS pakai `id` di response sebagai konfirmasi sync.

**Catatan penting:**
- Server **tidak** menghitung ulang `hpp_snapshot`. POS kirim apa adanya;
  laporan profit pakai snapshot itu. Jadi POS harus pakai `menu.hpp_cached`
  dari read endpoint, bukan re-compute.
- Bundle: kirim `bundle_id`, `menu_id: null`, `name_snapshot` = nama bundle,
  `unit_price` = harga bundle. Server **tidak** auto-deduct stok untuk
  komponen bundle saat ini (gap MVP — track di issue lanjutan).
- Diskon, PPN, service charge: dihitung POS, dikirim sebagai field literal.
  Tidak ada server-side recompute.

### 4.2. Void

**Granularity baru (April 2026): per-item, bukan per-struk.** Kasir bisa
void satu menu spesifik (mis. salah racik latte) tanpa membatalkan
seluruh struk — sisa item tetap terhitung sebagai revenue. Stok TIDAK
direstore: bahan sudah dipakai → masuk laporan kerugian operasional
(`reports/void-by-menu`, `reports/void-by-staff`, dst).

Body untuk kedua endpoint:
```json
{ "reason": "Salah racik — pelanggan minta less sugar" }
```
Trim + min 1 char, max 500. Bisa template ATAU komentar bebas. Cross-outlet
guard: non-owner cuma boleh void transaksi outlet sendiri (selain itu 404
untuk privacy). Hanya transaksi `status === "paid"` yang bisa di-void.

#### 4.2.a. `POST /api/transactions/:id/items/:itemId/void` *(utama)*
Void satu item di struk. Idempotent guard: kalau item sudah pernah
di-void, balikin 400 (`"Item sudah di-void sebelumnya"`) supaya atribusi
user/reason yang asli tidak ketimpa.

Response:
```json
{ "ok": true, "item_id": "ti_xxx", "voided_at": "2026-04-25T10:23:45.000Z" }
```

`transactions.status` tetap `"paid"` setelah void per-item — laporan Void
mengambil dari `transaction_items.voided_at`, bukan status flip. Berarti
revenue di laporan = Σ subtotal item aktif − discount_total per tx
(otomatis exclude item ter-void).

#### 4.2.b. `POST /api/transactions/:id/void` *(shortcut)*
Convenience untuk "void seluruh struk" — equivalen dengan N call ke
4.2.a dengan reason yang sama. Berguna saat kasir memang mau buang seluruh
order (mis. customer batal sebelum minum apapun).

Response:
```json
{ "ok": true, "voided_count": 3 }
```

`voided_count` = jumlah item yang baru saja di-void di call ini (item yang
sebelumnya sudah voided di-skip). Kalau semua item sudah voided sebelumnya
→ 400 (`"Tidak ada item aktif untuk di-void"`).

### 4.3. `GET /api/transactions/:id` & `GET /api/transactions`
Untuk POS yang ingin re-fetch (mis. user buka history shift), gunakan:
```http
GET /api/transactions?outlet_id=out_dago&start=2026-04-25T00:00:00.000Z
                     &end=2026-04-25T23:59:59.999Z
                     &status=paid
                     &order_type=dine_in
```
Limit hard-coded 1000 — POS tidak boleh scrape semua history dari sini.
Untuk laporan harian, query per shift saja.

### 4.4. (Optional) `POST /api/attendance`
Clock-in/out kasir. Lihat `src/app/api/attendance/route.ts` — schema-nya
mandiri. POS panggil saat tap "Mulai Shift" / "Akhiri Shift".

---

## 5. Sync Strategy

| Kategori           | Strategi                                                               |
|--------------------|------------------------------------------------------------------------|
| Master data        | Pull on app start + periodic refresh (default 5 min) + manual "Refresh"|
| Diskon dengan jam  | Pull tiap kali kasir buka cart (cek `active_hour_start/end` realtime)  |
| Stok bahan         | Pull setiap kali POS commit transaksi (refresh `ingredients` row)      |
| Transaksi          | Push immediately on payment-confirm; offline queue + retry             |
| Void item / struk  | Push immediately; user-blocking modal sampai 200/4xx                   |

**Offline queue (recommended):**
- Saat network down, POS simpan transaksi di local DB (SQLite/IndexedDB)
  dengan flag `synced: false`.
- Background worker retry tiap 30s; idempotency key (`id`) menjamin
  re-POST tidak double-create.
- Stok deduction terjadi saat transaksi sukses sync, bukan saat dibuat
  offline → laporan bisa skew sebentar. Acceptable untuk MVP; worst-case
  outlet operator manual sesuaikan via opname.

**ETag / If-None-Match:** belum disupport. Saat ini full GET tiap refresh.
Saat traffic besar, tambah caching layer (`ETag` per resource, 304 reply)
— tracked sebagai improvement.

---

## 6. RBAC Snapshot (untuk POS UI gating)

| Role         | Scope outlet  | POST `/transactions` | Void item / struk |
|--------------|---------------|----------------------|-------------------|
| owner        | semua         | ya                   | ya                |
| kepala_toko  | outlet sendiri| ya                   | ya                |
| kasir        | outlet sendiri| ya                   | ya                |
| barista      | outlet sendiri| **tidak** (403)      | tidak             |
| kitchen      | outlet sendiri| tidak                | tidak             |
| waiters      | outlet sendiri| tidak                | tidak             |

POS halaman cashier gate akses ke role ∈ {owner, kepala_toko, kasir}.
Role lain hanya boleh KDS / order-taking client (out of scope dokumen ini).

---

## 7. Cross-Domain Deployment

Lihat `docs/deploy-turso.md` §6 untuk konfigurasi cookie + env. Ringkas:

- POS & Backoffice **same-site** (custom domain `*.allee.id`):
  set `BETTER_AUTH_URL` ke domain backoffice, biarkan cookie default.
- POS & Backoffice **cross-site** (mis. dua subdomain `*.vercel.app`):
  set `defaultCookieAttributes.sameSite = "none"` + `secure: true` di
  `src/server/auth/index.ts`, dan POS fetch dengan `credentials: "include"`.
- POS native (mobile / Electron): forward `Set-Cookie` di token storage,
  kirim balik di `Cookie` header. CORS tidak relevan.

---

## 8. Roadmap & Known Gaps

| # | Gap                                                          | Priority |
|---|--------------------------------------------------------------|----------|
| 1 | `POST /api/auth/pos-pin` — exchange PIN → session            | High     |
| 2 | Bearer token issue endpoint untuk runtime cross-origin       | Medium   |
| 3 | Bundle stock auto-deduct (sekarang skip)                     | Medium   |
| 4 | `ETag` / `If-None-Match` di endpoint master data             | Low      |
| 5 | Per-platform (ojol) order ingest endpoint                    | Low      |
| 6 | Webhook outbound saat menu/harga berubah (POS push refresh)  | Low      |

Semua gap ini tidak menghalangi MVP — POS bisa dibangun sekarang dengan
`email+password` sign-in dan polling refresh.

---

## 9. Changelog

- **2026-04-25** v1 draft. Initial contract berdasar deploy production
  `f6543c0` (menus contract fix + libSQL backend).
