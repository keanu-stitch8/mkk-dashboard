# MKK Analytics — Dashboard bulanan Main ke Kudus

Dashboard analisa & report bulanan untuk 4 channel **Main ke Kudus**: Website (GA4 + Search Console), News, YouTube, dan Social Media (Meta). Data masuk lewat upload file export (tanpa API berbayar). Setiap bulan bisa dilihat sendiri, dibandingkan dengan bulan sebelumnya (MoM), dilihat tren 6 bulan, dan ada rekomendasi otomatis.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix, preset Nova) · Prisma 6 + SQLite · Recharts (via shadcn Chart) · papaparse · SheetJS · Vitest

---

## Cara menjalankan

```bash
npm install
cp .env.example .env        # sekali saja, berisi DATABASE_URL="file:./dev.db"
npx prisma migrate dev      # membuat database SQLite (prisma/dev.db)
npm run seed                # import semua file di ./data-samples
npm run dev                 # buka http://localhost:3000
```

Perintah lain:

| Perintah | Fungsi |
|---|---|
| `npm test` | Tes parser (memakai file di `data-samples/` + contoh sintetis) |
| `npm run build` | Build production |
| `npm run seed -- ./folder-lain` | Import semua file dari folder lain |
| `npm run inspect -- file1.csv file2.xlsx` | Lihat hasil parsing file tanpa menyimpan ke DB |
| `npx prisma studio` | Lihat isi database |

### Data di `data-samples/`

Semua file export yang dipakai dashboard disimpan per bulan, sehingga `npm run seed` membangun ulang dashboard yang sama persis:

```
data-samples/
  2026-07/   GA4 (5 CSV) · GSC (ZIP) · YouTube (ZIP)
  2026-08/   GA4 (5 CSV) · GSC (ZIP) · YouTube (ZIP) · IG Agustus · Report News & Social Media Agustus
  2026-09/   GA4 (5 CSV) · GSC (XLSX) · YouTube (folder) · IG September
             · Report News, YouTube, Social Media September
```

- Seed mem-parse **per folder**. Nama folder `YYYY-MM` menentukan bulan tujuan, dan baris dari bulan lain dibuang. Contohnya: baris 31 Agustus di export Meta September tidak akan menimpa data Agustus.
- Untuk menambah bulan baru, buat folder `YYYY-MM`, taruh file export-nya, lalu jalankan `npm run seed`. Seed aman diulang karena sifatnya replace per bulan + sumber.
- File yang di-upload lewat halaman Import hanya masuk ke database lokal. Simpan juga file-nya di sini supaya ikut ter-versi.

---

## Halaman

| Halaman | Isi |
|---|---|
| **Overview** (`/`) | KPI lintas channel + MoM, tren 6 bulan per channel, panel rekomendasi. Default: bulan terakhir yang punya data. |
| **Website** | Users, sessions, views, engagement/bounce rate, GSC clicks/impressions/CTR/posisi, sumber traffic, top pages, top query, peluang query posisi 4–10, perbandingan MoM. |
| **News** | Artikel published/review, kuota & achievement, total views & views per artikel, top artikel, performa per kategori/reporter/tipe, artikel yang tidak cocok dengan GA4. |
| **YouTube** | Views, watch time, subscriber, impressions & CTR, avg view duration, kuota video, top video, views per kategori. |
| **Social Media** | Posts vs kuota (IG Reels & Carousel), hari aktif publish, reach/views/interaksi, engagement rate, performa per format/kategori/platform, top post. |
| **Import Data** | Upload + preview, input manual, pengaturan kuota, riwayat import (hapus). |
| **Report** (`/report`) | Ringkasan bulan siap cetak → tombol **Cetak / Simpan PDF** (print stylesheet). |

Bulan dipilih lewat selector di kanan atas (disimpan di URL `?m=YYYY-MM`). Dark mode lewat ikon matahari/bulan di kanan atas (Terang / Gelap / Sistem). Sidebar bisa diciutkan (ikon panel di kiri atas atau `Ctrl/⌘ + B`).

---

## Cara export data dari tiap platform

> Selalu set rentang tanggal **satu bulan penuh** (tgl 1 s/d akhir bulan). Parser membaca bulan dari isi file bila tersedia; jika berbeda dengan bulan yang dipilih, preview akan memberi peringatan.

### 1. Google Analytics 4 (Website)

Untuk setiap report di bawah: buka report → set tanggal → ikon **Share this report** (kanan atas) → **Download File** → **Download CSV**.

| Report | Lokasi di GA4 | Dipakai untuk |
|---|---|---|
| **Traffic acquisition** | Reports → Acquisition → Traffic acquisition | Sessions, engaged sessions, engagement rate, avg engagement time, sumber traffic |
| **Pages and screens** | Reports → Engagement → Pages and screens (dimensi *Page path and screen class*) | Views/pageviews, top pages, **views per artikel News** |
| **Landing page** | Reports → Engagement → Landing page | Top landing page (cadangan sessions & new users) |
| **Generate leads overview** / **User acquisition overview** | Reports → (overview) | **Total users** (baris *All Users*) & **new users** |
| Demographic details: City *(opsional)* | Reports → User attributes → Demographic details → City | Kota teratas |

Catatan:
- Export CSV GA4 punya baris komentar `# ...` di atas tabel. Parser otomatis melewatinya dan membaca *Start date/End date* untuk menentukan bulan.
- UI GA4 berbahasa Indonesia juga didukung (mis. *Sesi*, *Pengguna aktif*, *Jalur halaman dan kelas layar*).
- **PDF tidak didukung**: PDF hanya memuat 10 baris teratas. Pakai CSV.
- Total users tidak bisa dijumlah dari tabel per channel/halaman (user dihitung ganda). Karena itu users diambil dari report overview (*All Users*). Kalau tidak ada, dipakai estimasi dari jumlah per kota (ditandai "estimasi"), atau isi manual.

### 2. Google Search Console (Website)

**Performance → Search results** → set tanggal (Custom: 1–akhir bulan) → **Export** → **Download Excel**.
Satu file XLSX berisi sheet *Chart, Queries, Pages, Countries, Devices, Filters*, dan semuanya terbaca sekaligus. Bulan diambil dari sheet *Filters*.
Alternatif: **Download CSV** (ZIP). Upload ZIP-nya langsung atau CSV satu per satu.

### 3. YouTube Studio

**Analytics → Advanced mode** → tab **Content** → set tanggal (Custom, 1 bulan) → ikon **Export current view → Comma-separated values (.csv)**.
Hasilnya ZIP/folder berisi `Table data.csv` (per video + baris *Total*), `Chart data.csv`, `Totals.csv`. Upload ZIP-nya atau ketiga CSV sekaligus.

> **Definisi laporan YouTube:** bulan X = **video yang dipublish di bulan X**, dengan performa (views, watch time, dst) **selama bulan X**, sama seperti report News.
> - Export dengan rentang **1–akhir bulan X** (nama file `Content 2026-08-01_2026-09-01 …`, tanggal akhir eksklusif), boleh difilter ke video yang dipublish bulan itu.
> - Angka YouTube Studio selalu performa selama rentang tanggal export, bukan sejak video dipublish. File "july" dengan rentang Agustus berisi views video Juli **selama Agustus**, dan itu tidak masuk laporan mana pun.
> - Saat import, video yang dipublish di luar bulan yang dipilih otomatis dibuang dan total dihitung ulang. Kalau hasilnya 0 video, dataset tidak disimpan dan data lama tidak diubah.
> Grafik harian (`Totals.csv` / `Chart data.csv`) hanya berisi **satu metrik**, yaitu metrik yang sedang dipilih di Advanced mode (biasanya kolom metrik pertama di tabel). Sebelum export, **klik header kolom "Watch time (hours)"** sampai grafik menampilkan watch time. Kalau grafik berisi metrik lain (Subscribers gained, Average views per viewer, dll), file harian dilewati dan preview menampilkan peringatan kuning.

Pastikan kolom berikut ada di tabel (tambah lewat tombol metrik **+**): *Views, Watch time (hours), Average view duration, Impressions, Impressions click-through rate (%), Unique viewers, Subscribers gained*. Tambahkan juga **Subscribers lost** supaya net subscriber akurat (sample sekarang belum punya kolom ini, jadi net = gained).

**Publishing log YouTube** (sheet *Publishing Log* di report XLSX, atau Google Sheets dengan kolom *Publish Date, Video, link YouTube, Format, Category, Status*) dipakai untuk kategori video & jumlah video published vs kuota.

### 4. Meta Business Suite (Instagram & Facebook)

**Insights → Content** → pilih akun **Instagram** atau **Facebook** → set tanggal → **Export data** → CSV.
Kolom yang dibaca: *Post ID, Publish time, Permalink, Post type, Views, Reach, Likes/Reactions, Comments, Shares, Saves, Follows* (atau versi Indonesianya).

- Platform dideteksi dari **isi file** (permalink instagram.com / facebook.com), bukan dari nama file. Contoh: `Insight IG Sept.csv` ternyata berisi post Facebook dan disimpan sebagai Facebook.
- Format: *IG reel / FB reel* → Reels, *IG carousel* → Carousel, *IG image* → Feeds, *FB Photos* → Foto, *FB Videos* (non-reel) → Video.
- Metrik Meta bersifat *Lifetime*, dan post dihitung di **bulan publish**-nya. Export setelah awal bulan berikutnya supaya angka sudah stabil.
- File berisi beberapa bulan otomatis difilter ke bulan yang dipilih.
- **Zona waktu:** "Publish time" di export Meta tercatat dalam **Pacific Time** (PDT/PST), bukan WIB. Saat import, waktunya otomatis dikonversi ke WIB (+14 jam saat PDT, +15 jam saat PST). Tanpa konversi, post yang dipublish siang hari WIB bisa tercatat di tanggal atau bulan sebelumnya.

### 5. Google Sheets (News Content Logs & publishing log sosmed)

**File → Download → Microsoft Excel (.xlsx)** untuk semua sheet sekaligus, atau **CSV** untuk sheet yang aktif. Boleh upload log satu tahun penuh, karena baris di luar bulan yang dipilih akan diabaikan.

**News Content Logs**, kolom yang dikenali (huruf besar/kecil bebas, alias Indonesia didukung):

| Kolom | Alias |
|---|---|
| Tanggal | Publish Date, Tanggal Publish, Planned Date, Date |
| Judul | Headline, Title, Judul Artikel |
| URL | Article URL, Link |
| Kategori | Category, Rubrik |
| Reporter | Kontributor, Contributor, Penulis, Writer |
| Status | Draft / Review / Publish (juga Published, Terbit, Tayang) |
| Tipe | Type, Jenis (Hard News / Features / Editorial) |
| Method | Metode |

Report News XLSX (`MKK News Monthly Performance Report - …xlsx`) didukung langsung: sheet *Publishing Log* dan *Articles Under Review* menjadi log artikel; sheet *Article Performance* dipakai sebagai cadangan views per artikel jika CSV GA4 *Pages and screens* belum di-import. Sheet *Executive Summary, Metric Guide, Ref* dilewati.

**Publishing log sosmed** adalah **sumber resmi kuota sosmed**: setiap baris dihitung 1 post (termasuk Stories), walaupun diposting ke beberapa channel. Kuota default 60 per bulan untuk semua format. Kolom: *Tanggal / Publish Date, Channel(s) / Platform (boleh banyak: "Instagram, Facebook, TikTok"), Tipe / Format (Stories/Reels/Shorts/Feeds/Videos; "Reels, Shorts" dihitung sebagai Reels), Kategori, Content / Judul, Admin, Designer, Status*. Report Social Media XLSX (sheet *Publishing Log*) bisa di-upload langsung. Kolom opsional: *Link*. Kategori dari log dipasangkan ke post Meta lewat link; kalau tidak ada link, dicocokkan lewat kemiripan judul log dengan caption + tanggal (±3 hari) + format. Post Meta yang tidak punya pasangan ditampilkan sebagai "tidak tercatat di Publishing Log".

---

## Import bulanan (checklist)

1. Buka **Import Data**, lalu pilih **bulan** (YYYY-MM).
2. Pilih **jenis sumber** (atau biarkan *Deteksi otomatis*), lalu upload file. Bisa beberapa file / ZIP sekaligus.
3. Cek **preview**: kolom yang terdeteksi (hijau), kolom yang tidak dipakai (abu-abu coret), jumlah baris, peringatan, dan contoh baris.
4. Klik **Simpan**. Upload ulang untuk bulan + sumber yang sama akan **menggantikan** data lama (idempotent).
5. Kalau ada angka yang tidak tersedia sebagai file, isi lewat **Input manual**. Nilai manual menimpa hasil import untuk bulan itu; kosongkan untuk kembali ke data import.
6. Atur **Kuota** jika berbeda dari default (Artikel 60, IG Reels 30, IG Carousel 30, YouTube 4), bisa untuk default semua bulan atau khusus satu bulan.

Urutan file per bulan yang disarankan: GA4 (4 CSV) → GSC (XLSX) → YouTube (ZIP + log) → Meta IG & FB (CSV) → News log (XLSX/CSV) → Social log.

---

## Definisi metrik

| Metrik | Definisi |
|---|---|
| Total reach / impressions (Overview) | Impressions Google Search + impressions thumbnail YouTube + reach sosmed |
| Total engagement (Overview) | Interaksi sosmed + engaged sessions website |
| Sessions | Jumlah sesi semua channel di Traffic acquisition (bisa selisih beberapa sesi dari total GA4 karena pembulatan GA4) |
| Engagement rate website | Engaged sessions ÷ sessions; **bounce rate** = 1 − engagement rate |
| Avg engagement time | Rata-rata per sesi, tertimbang jumlah sesi per channel |
| GSC CTR / posisi | Clicks ÷ impressions; posisi rata-rata tertimbang impressions |
| Achievement News | (Published + In review) ÷ kuota, sama dengan "Delivered" di report News. Published ÷ kuota ditampilkan terpisah |
| Total views News | Jumlah views GA4 untuk URL artikel yang published bulan itu (exact match, tanpa trailing slash & query string) |
| Interaksi sosmed | IG: likes + comments + shares + saves · FB: kolom *Reactions, Comments and Shares* |
| Engagement rate sosmed | Interaksi ÷ reach (reach = jumlah reach per post) |
| MoM | Hanya dihitung jika bulan lalu punya data channel yang sama. Untuk sosmed hanya platform yang ada di kedua bulan yang dibandingkan |

---

## Rekomendasi

Engine ada di [`lib/recommendations.ts`](lib/recommendations.ts). Setiap rule berisi `id`, `channel`, `mom` (butuh data bulan lalu?), dan fungsi `run` yang mengembalikan prioritas (tinggi/sedang/rendah), judul, dan teks Bahasa Indonesia berisi angkanya. Rule `mom: true` otomatis dilewati jika data bulan lalu belum ada.

Rule yang tersedia: impressions GSC naik tapi CTR turun · query posisi 4–10 · halaman CTR rendah · engagement rate website turun >10% · perubahan sesi signifikan · ketergantungan satu sumber traffic · kuota artikel < 90% · kategori dengan views per artikel tertinggi · artikel tidak cocok GA4 / 0 views · hari tanpa artikel · views per artikel turun · CTR thumbnail YouTube < 4% · retensi video rendah · kuota video · views YouTube turun · kuota IG Reels/Carousel < 90% · engagement rate sosmed turun >10% per platform · format dengan reach/post jauh lebih tinggi (mis. Reels vs Feeds) · kategori sosmed terbaik · hari publish kosong berturut-turut.

Menambah rule: tambahkan objek baru ke array `RULES`. Data yang bisa dipakai ada di `ctx.cur` / `ctx.prev` (lihat tipe `MonthBundle` di `lib/data/summary.ts`).

---

## Struktur kode

```
prisma/schema.prisma        schema DB (portable SQLite ↔ PostgreSQL)
prisma/seed.ts              import ./data-samples
lib/parsers/                parser file → dataset
  tabular.ts                baca CSV (blok + komentar #), XLSX, ZIP
  headers.ts                pencocokan header fleksibel + alias
  values.ts                 parse angka/persen/durasi/tanggal (en & id)
  ga4.ts gsc.ts youtube.ts meta.ts logs.ts
  index.ts                  deteksi otomatis, merge, filter bulan
lib/import/commit.ts        simpan dataset (replace per bulan+sumber)
lib/data/summary.ts         query & ringkasan per channel, tren, MoM
lib/recommendations.ts      engine rekomendasi
lib/sources.ts              katalog sumber, kuota default, field input manual
app/                        halaman & API route
components/ui/              komponen shadcn/ui (hasil `npx shadcn add …`, jangan diedit kecuali perlu)
components/blocks.tsx       KPI card, delta MoM, tabel, empty state (di atas shadcn)
components/charts.tsx       grafik tren & breakdown (shadcn Chart + Recharts)
components/AppSidebar.tsx   navigasi (shadcn Sidebar)
components/import/          form import, input manual, kuota
tests/parsers.test.ts       tes parser
```

---

## Pindah ke PostgreSQL

Schema sengaja hanya memakai tipe portable (String/Int/Float/DateTime, tanpa enum/Json/fitur khusus SQLite).

1. Ubah `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Ubah `.env`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/mkk?schema=public"
   ```
3. Folder migrasi lama khusus SQLite, jadi hapus lalu buat ulang:
   ```bash
   rm -rf prisma/migrations
   npx prisma migrate dev --name init
   ```
4. Isi data: `npm run seed`, atau import ulang file per bulan lewat halaman Import. Untuk memindahkan data dari SQLite, export tabel lewat `npx prisma studio` atau tool seperti `pgloader`.

---

## Keterbatasan yang diketahui (data Juli–September 2026)

- News Content Log Juli dan Publishing Log sosmed Juli belum ada. Untuk bulan tanpa log, News tampil kosong dan kuota sosmed dihitung dari export Meta (tanpa Stories).
- Belum ada data Facebook. Parser Facebook tetap tersedia: upload export Meta untuk Page Facebook kapan saja.
- TikTok belum dimasukkan. Baris TikTok di publishing log tetap tersimpan, tanpa metrik performa.
- Batas "carousel maks 8 slide" belum dicek otomatis karena export Meta tidak memuat jumlah slide.
- Tanpa autentikasi, hanya untuk localhost.
