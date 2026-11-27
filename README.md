# Inventory & Sales API

![Node.js](https://img.shields.io/badge/Node.js-22-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5%20strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)
![Swagger](https://img.shields.io/badge/Docs-Swagger-85EA2D?style=flat-square&logo=swagger&logoColor=black)
![Jest](https://img.shields.io/badge/Test-Jest%2030-C21325?style=flat-square&logo=jest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

REST API untuk mengelola produk, stok, dan penjualan. Proyek ini berfokus pada logika bisnis di luar CRUD: pencatatan penjualan dan pengurangan stok berjalan dalam satu transaksi database, sehingga stok tetap konsisten saat ada permintaan bersamaan.

Status: `Active`, belum ada pengguna nyata.

## Fitur utama

- Penjualan atomik yang aman terhadap permintaan bersamaan.
- Autentikasi JWT dengan peran admin dan staf.
- Laporan penjualan harian dan stok menipis.
- Validasi input per field dengan format error yang seragam.
- Dokumentasi interaktif melalui Swagger.
- Unit test, test end-to-end, dan koleksi Postman.

## Menjalankan

Prasyarat: Docker dengan Compose.

```bash
docker compose up --build
```

| Layanan | URL |
|---|---|
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/docs |

Saat start, container API menjalankan migrasi database. Seed akun dan data demo hanya berjalan bila `SEED_DEMO=true`. Seed bersifat idempoten dan tidak mengembalikan stok yang sudah berubah.

`docker-compose.yml` menyalakan `SEED_DEMO` untuk demo lokal, sedangkan image secara bawaan tidak melakukan seed. Jangan nyalakan `SEED_DEMO` pada deployment nyata karena kredensial demo di bawah bersifat publik.

### Akun demo (fiktif)

| Peran | Email | Password |
|---|---|---|
| Admin | `admin@demo.test` | `Admin123!demo` |
| Staf | `staf@demo.test` | `Staf123!demo` |

Login melalui `POST /auth/login`, lalu kirim header `Authorization: Bearer <accessToken>`.

## Endpoint

| Method | Path | Akses |
|---|---|---|
| POST | `/auth/login` | publik |
| GET | `/products`, `/products/:id` | admin, staf |
| POST | `/products` | admin |
| PATCH, DELETE | `/products/:id` | admin |
| POST | `/sales` | admin, staf |
| GET | `/reports/daily-sales?from=YYYY-MM-DD&to=YYYY-MM-DD` | admin |
| GET | `/reports/low-stock` | admin |

Semua error menggunakan format yang sama:

```json
{ "statusCode": 409, "error": "Conflict", "message": "..." }
```

Pada error validasi, `message` berupa daftar dengan satu entri per field.

## Perilaku sistem

### Penjualan

Stok dikurangi dengan `UPDATE ... WHERE stock >= qty` di dalam `prisma.$transaction`. Jika stok salah satu item tidak cukup, seluruh penjualan dibatalkan dengan status 409. Dari dua penjualan bersamaan atas stok terakhir, tepat satu yang berhasil.

### Laporan

- Tanggal dipotong menurut UTC.
- Parameter `to` bersifat inklusif.
- Tanpa parameter, rentangnya 30 hari terakhir.
- Stok dianggap menipis bila `stock <= minStock`.

### Autentikasi dan keamanan

- API hanya menerbitkan access token (bawaan 15 menit) tanpa refresh token. Refresh token tersedia di proyek starter kit terpisah.
- Peran dibaca dari database pada setiap request, bukan dari token. User yang dihapus atau diturunkan perannya langsung kehilangan akses, dengan biaya satu query ringan per request.
- Aplikasi menolak start dengan `JWT_SECRET` contoh dari repositori ini, kecuali `SEED_DEMO=true`.
- Port database di Compose hanya terikat ke `127.0.0.1`.

### Data dan validasi

- Nilai uang dikembalikan sebagai string desimal (`"40000"`) agar presisinya terjaga.
- Harga maksimum 1.000.000.000. Batas ini menjamin total penjualan terbesar tetap muat di kolom database.
- Body dengan nilai `null` ditolak (400) per field.
- Id yang bukan integer 32-bit positif ditolak (400).

## Variabel lingkungan

Untuk menjalankan tanpa Docker, salin `.env.example` ke `.env`, lalu ganti `JWT_SECRET` dengan string acak milik sendiri. Aplikasi gagal start bila variabel wajib hilang.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | URL PostgreSQL |
| `JWT_SECRET` | ya | Minimal 32 karakter |
| `JWT_EXPIRES_IN` | tidak | Bawaan `15m` |
| `PORT` | tidak | Bawaan `3000` |
| `SEED_DEMO` | tidak | `true` untuk seed akun dan data demo saat container start. Bawaan image: mati |

`JWT_EXPIRES_IN` harus berbentuk durasi seperti `15m`, `1h`, atau `7d`. Nilai yang salah bentuk membuat aplikasi gagal saat start, sebelum sempat dipakai untuk login.

Compose memakai nilai demo palsu untuk `JWT_SECRET`. Pada deployment nyata, setel `JWT_SECRET` sendiri.

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

Setiap run e2e membuat database kosong baru (`inventory_e2e_<timestamp>`), memigrasi dan men-seed database tersebut, lalu menghapusnya, sehingga database dev tidak tersentuh. Target dapat diubah dengan `E2E_ADMIN_URL`. Database test sengaja disetel ke zona waktu `Asia/Jakarta` agar bug pemotongan hari di laporan langsung terlihat.

Cakupan pengujian:

- Login salah dan format error.
- Pembatasan peran (staf ditolak dengan 403).
- Pembacaan ulang peran dari database (user yang dihapus atau diturunkan perannya langsung ditolak).
- Validasi per field, termasuk `null` dan id di luar rentang.
- Penjualan sukses.
- Penolakan atomik (stok dan tabel penjualan tidak berubah).
- Konkurensi: dari 6 permintaan serentak atas stok 1, tepat satu berhasil.
- Total penjualan terbesar yang mungkin.
- Laporan yang dicocokkan dengan hitungan manual dari data seed.

## Postman

Koleksi dan environment (`local`, `demo`) tersedia di folder `postman/`. Environment `demo` belum berisi URL dan password karena hosting belum diputuskan.

```bash
npx newman run postman/inventory-sales.postman_collection.json -e postman/local.postman_environment.json
```

## Batasan yang diketahui

- Harga dibaca di dalam transaksi tetapi tanpa penguncian baris, jadi perubahan harga yang bersamaan dengan penjualan bisa memakai harga lama.
- Belum ada pembatasan percobaan login (rate limiting) dan header keamanan (helmet). Untuk deployment publik, pasang di depan API (reverse proxy) atau tambahkan sendiri.
- `/docs` terbuka tanpa autentikasi.
- `npm audit --omit=dev` melaporkan 4 temuan severity tinggi, semuanya pada rantai CLI Prisma 6 (`prisma` → `@prisma/config` → `effect`, `deepmerge-ts`). Rantai itu berjalan saat build dan `migrate deploy` dengan konfigurasi milik sendiri, tidak pada request HTTP, dan `@prisma/client` tidak terdampak. Perbaikannya hanya lewat Prisma 7 (perubahan besar) dan belum dikerjakan.
- Belum ada pagination pada `GET /products`.
- Belum ada modul manajemen pengguna. Akun dibuat lewat seed.
- Di luar lingkup: payment gateway, multi-tenant, realtime, dan ekspor PDF.

## Lisensi

MIT, lihat [`LICENSE`](LICENSE).
