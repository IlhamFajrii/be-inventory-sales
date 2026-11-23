# Inventory & Sales API

API untuk mengelola produk, stok, dan penjualan. Fokusnya logika bisnis, bukan hanya CRUD: penjualan dan pengurangan stok terjadi dalam satu transaksi database.

Stack: NestJS, TypeScript (strict), Prisma, PostgreSQL, JWT, Docker Compose. Status: `Active` (belum ada pengguna nyata).

## Menjalankan

Prasyarat: Docker dengan Compose.

```bash
docker compose up --build
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/docs

Saat start, container API menjalankan migrasi. Seed akun dan data demo (idempoten, tidak mengembalikan stok yang sudah berubah) hanya berjalan bila `SEED_DEMO=true`. `docker-compose.yml` menyalakannya untuk demo lokal, sedangkan image-nya sendiri **tidak** men-seed apa pun secara bawaan. Di deployment nyata jangan nyalakan `SEED_DEMO`, karena kredensial demo di bawah bersifat publik.

### Akun demo (fiktif)

| Peran | Email | Password |
|---|---|---|
| Admin | `admin@demo.test` | `Admin123!demo` |
| Staf | `staf@demo.test` | `Staf123!demo` |

Login lewat `POST /auth/login`, lalu kirim `Authorization: Bearer <accessToken>`.

## Endpoint

| Method | Path | Peran |
|---|---|---|
| POST | `/auth/login` | publik |
| GET | `/products`, `/products/:id` | admin, staf |
| POST, PATCH, DELETE | `/products`, `/products/:id` | admin |
| POST | `/sales` | admin, staf |
| GET | `/reports/daily-sales?from=YYYY-MM-DD&to=YYYY-MM-DD` | admin |
| GET | `/reports/low-stock` | admin |

Semua error berbentuk `{ "statusCode": 409, "error": "Conflict", "message": "..." }`. Error validasi memuat `message` berupa daftar, satu entri per field.

Catatan perilaku:
- **Penjualan atomik.** Stok dikurangi dengan `UPDATE ... WHERE stock >= qty` di dalam `prisma.$transaction`. Satu item kurang stok membatalkan seluruh penjualan (409). Dua penjualan bersamaan atas stok terakhir menghasilkan tepat satu keberhasilan.
- **Laporan** memotong tanggal di UTC. `to` bersifat inklusif. Tanpa parameter, rentangnya 30 hari terakhir. Stok menipis berarti `stock <= minStock`.
- **Token.** Hanya access token (default 15 menit), tanpa refresh token. Refresh token ada di proyek starter kit terpisah.
- Nilai uang dikembalikan sebagai string desimal (`"40000"`) agar tidak kehilangan presisi. Harga maksimum 1.000.000.000, batas yang menjamin total penjualan terbesar tetap muat di kolom.
- **Peran dibaca dari database di setiap request**, bukan dari token. User yang dihapus atau diturunkan perannya langsung kehilangan akses. Harganya satu query ringan per request.
- Body dengan nilai `null` ditolak 400 per field. Id yang bukan integer 32-bit positif ditolak 400.

## Variabel lingkungan

Salin `.env.example` ke `.env` untuk menjalankan tanpa Docker. Aplikasi gagal start bila variabel wajib hilang.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | URL PostgreSQL |
| `JWT_SECRET` | ya | Minimal 32 karakter |
| `JWT_EXPIRES_IN` | tidak | Bawaan `15m` |
| `PORT` | tidak | Bawaan `3000` |
| `SEED_DEMO` | tidak | `true` = seed akun dan data demo saat container start. Bawaan image: mati |

`JWT_EXPIRES_IN` harus berbentuk `15m`, `1h`, atau `7d`. Nilai yang salah bentuk membuat aplikasi gagal start, bukan gagal saat login.

Compose memakai nilai demo palsu untuk `JWT_SECRET`. Untuk deployment nyata, setel `JWT_SECRET` sendiri.

## Pengembangan

```bash
docker compose up -d db        # hanya database
npm install
npx prisma migrate dev         # migrasi lokal
npm run start:dev
npm run build
```

## Test

```bash
npm run test       # unit
npm run test:e2e   # e2e, butuh database dari `docker compose up -d db`
```

E2E membuat database baru yang kosong di setiap run (`inventory_e2e_<timestamp>`), memigrasi dan men-seed-nya, lalu menghapusnya. Database dev tidak tersentuh. Ubah target dengan `E2E_ADMIN_URL`. Database itu sengaja disetel ke zona waktu `Asia/Jakarta` agar bug pemotongan hari di laporan langsung terlihat.

Yang diuji: login salah dan format error, peran (staf ditolak 403), peran dibaca ulang dari database (user dihapus atau diturunkan langsung ditolak), validasi per field termasuk `null` dan id di luar rentang, penjualan sukses, penolakan atomik (stok dan tabel penjualan tidak berubah), konkurensi (6 permintaan serentak atas stok 1, tepat satu berhasil), total penjualan terbesar yang mungkin, dan laporan yang dicocokkan dengan hitungan manual dari data seed.

## Postman

Koleksi dan environment ada di `postman/` (`local`, `demo`). Environment `demo` belum berisi URL dan password karena hosting belum diputuskan.

```bash
npx newman run postman/inventory-sales.postman_collection.json -e postman/local.postman_environment.json
```

## Batasan yang diketahui

- Harga dibaca di dalam transaksi tetapi tanpa penguncian baris, jadi perubahan harga yang bersamaan dengan penjualan bisa memakai harga lama.
- Belum ada pembatasan percobaan login (rate limiting) dan header keamanan (helmet). Untuk deployment publik, pasang di depan API (reverse proxy) atau tambahkan sendiri.
- `/docs` terbuka tanpa autentikasi.
- Belum ada pagination pada `GET /products`.
- Belum ada modul manajemen pengguna. Akun dibuat lewat seed.
- Di luar lingkup: payment gateway, multi-tenant, realtime, ekspor PDF.

## Lisensi

MIT, lihat `LICENSE`.
