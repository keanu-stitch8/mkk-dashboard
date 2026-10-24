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
| `npm run sync -- --month=YYYY-MM` | Tarik data dari connector API (lihat Setup Connector) |
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

## Laporan bulanan Google Sheets

Dashboard membuat laporan untuk client sebagai **file Google Sheets baru** dari master template per channel
(Website, News). File laporan/template buatan user tidak pernah diubah — app hanya bisa menulis ke file yang
dibuatnya sendiri (scope `drive.file`).

1. Aktifkan **Google Sheets API** di project Google Cloud OAuth client, lalu hubungkan ulang akun Google di kartu
   Google Sheets (Pengaturan → Connectors) dan centang semua izin.
2. Buat master template sekali: `npx tsx scripts/report-template-website.ts --from=<ID laporan contoh>` → isi
   `REPORT_TEMPLATE_WEBSITE=<id>` di `.env.local`. Template bebas diedit (warna, posisi, teks) selama penanda
   `{{…}}` tetap ada; `{{#tabel.kolom}}` = baris tabel yang digandakan otomatis sesuai jumlah data.
   News sama: `npx tsx scripts/report-template-news.ts --from=<ID laporan News contoh>` → `REPORT_TEMPLATE_NEWS=<id>`.
   Perubahan teks setelah template diedit user: `--patch=<id>` (jangan buat ulang, edit visual user hilang).
   Penanda khusus: `{{pagebreak}}` = PDF mulai halaman baru di baris itu. Sheet tersembunyi (mis. Ref) tidak ikut PDF.
3. Halaman **Report** → "Buat laporan Google Sheets". Cron membuat laporan otomatis tgl 3 setelah bulan dikunci.
   Laporan lama bulan yang sama diberi akhiran "(lama …)", salinan yang gagal diisi diberi "(GAGAL …)".

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

## Setup Connector (tarik data otomatis via API)

Connector menarik data GA4, Search Console, YouTube, dan Meta langsung dari API. Hasilnya disimpan ke **tabel yang sama** dengan import CSV, jadi dashboard dan rekomendasi tidak berubah. Sync untuk bulan + sumber yang sama menggantikan data lama (idempotent), termasuk data hasil import CSV. Import CSV tetap bisa dipakai kapan saja sebagai fallback.

| Connector | Status | Mengisi |
|---|---|---|
| Google Analytics 4 | ✅ siap | GA4 Traffic acquisition, Pages and screens (termasuk views artikel News), Landing page, Overview, City |
| Google Search Console | ✅ siap | GSC Queries (top 1000), Pages (top 1000), Dates, Countries, Devices + total resmi |
| YouTube | ✅ siap | YouTube per video (long-form yang dipublish bulan itu) + harian; impressions & CTR via laporan Reach |
| Meta (IG & FB) | ✅ siap | Instagram per post + insight akun selama bulan itu (views, interactions, reach, follows). Facebook dimatikan (`ACTIVE_SOCIAL_PLATFORMS`) |
| Google Sheets | ✅ siap | Publishing Log News, Sosmed, YouTube (dicari otomatis per nama file + bulan) |

### 1. File `.env.local`

Salin bagian "Connector API" dari `.env.example` ke **`.env.local`**. File ini sudah di-`.gitignore`, jadi tidak ikut ter-commit. Restart `npm run dev` setiap kali mengubah `.env.local`.

```bash
openssl rand -base64 32   # → isi ENCRYPTION_KEY
```

### 2. Google Cloud: project, API, service account

1. Buka https://console.cloud.google.com → buat project baru (mis. `mkk-dashboard`).
2. **APIs & Services → Library**, aktifkan:
   - **Google Analytics Data API**
   - Google Search Console API *(untuk connector GSC)*
   - YouTube Data API v3, YouTube Analytics API, dan **YouTube Reporting API** *(untuk connector YouTube)*
3. *(Opsi A saja)* **IAM & Admin → Service Accounts → Create service account** (mis. `mkk-dashboard`). Langkah "Grant this service account access to project" dikosongkan.
4. *(Opsi A saja)* Buka service account itu → **Keys → Add key → Create new key → JSON**. Simpan file-nya **di luar folder project** (mis. `~/secrets/mkk-dashboard-sa.json`), lalu isi path-nya di `GOOGLE_APPLICATION_CREDENTIALS`.
5. *(Opsi A saja)* Catat email service account-nya (`…@….iam.gserviceaccount.com`); dipakai di langkah berikut.

### 3. GA4

Isi `GA4_PROPERTY_ID` dengan **Property ID** (angka, mis. `412345678`) dari GA4 → Admin → Property details. Measurement ID `G-XXXX` bukan Property ID. Kalau tidak bisa membuka Admin, minta ke admin GA4.

Lalu pilih cara akses:

**Opsi A — Service account** (cocok untuk sync otomatis; butuh **admin GA4**):
1. Minta admin GA4 menambahkan email service account di **Admin → Property access management → + → Add users** dengan role **Viewer**.
2. Isi `GOOGLE_APPLICATION_CREDENTIALS`.

**Opsi B — Login akun Google kamu** (jika kamu bisa membuka laporan GA4 tapi bukan admin):
1. Google Cloud → **APIs & Services → OAuth consent screen**: User type **External**, isi nama aplikasi (mis. "MKK Dashboard") dan email. Di bagian **Data access / Scopes** tambahkan `…/auth/analytics.readonly` (nanti juga `webmasters.readonly`, `yt-analytics.readonly`, `youtube.readonly`).
2. **Audience / Publishing status → Publish app → In production.** Kalau tetap di mode *Testing*, refresh token kedaluwarsa tiap 7 hari. Aplikasi tidak perlu diverifikasi Google untuk dipakai sendiri; saat login akan muncul layar "Google hasn't verified this app" → **Advanced → Go to MKK Dashboard (unsafe)**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → tipe **Web application** → *Authorized redirect URIs*: `http://localhost:3000/api/auth/google/callback` → Create. Salin Client ID & Client secret ke `GOOGLE_OAUTH_CLIENT_ID` dan `GOOGLE_OAUTH_CLIENT_SECRET`.
4. Isi `ENCRYPTION_KEY` (refresh token disimpan terenkripsi di database), restart `npm run dev`.
5. Halaman **Connectors API** → kartu GA4 → **Hubungkan akun Google** → login dengan akun yang bisa membuka GA4 Main ke Kudus → centang izin.

Jika `GOOGLE_APPLICATION_CREDENTIALS` diisi, service account didahulukan. Setelah itu klik **Test koneksi** di kartu GA4.

Data yang ditarik per bulan: total active users & new users, sessions/engaged sessions/engagement rate per `sessionDefaultChannelGroup`, views per `pagePath` + judul halaman, landing page, new users per first-user channel, dan active users per kota. Path dinormalisasi persis seperti parser CSV, jadi views artikel News otomatis tercocokkan ke URL di content log.

### 4. Search Console

1. Aktifkan **Google Search Console API**: https://console.cloud.google.com/apis/library/searchconsole.googleapis.com
2. Isi `GSC_SITE_URL` persis seperti nama properti di Search Console: properti *Domain* → `sc-domain:mainkekudus.com`; properti *URL prefix* → `https://mainkekudus.com/`. Nama polos (`mainkekudus.com`) juga diterima dan dicocokkan otomatis ke properti yang bisa diakses.
3. Akses — pilih salah satu:
   - **Login akun Google** (sama seperti GA4 opsi B): kartu Search Console → **Hubungkan akun Google**. Izinnya terpisah dari GA4, jadi perlu klik sekali lagi. Akun harus punya akses (minimal *Restricted*) ke properti di Search Console.
   - **Service account**: pemilik properti menambahkan email service account di Search Console → Settings → **Users and permissions → Add user** (Restricted).
4. **Test koneksi** di kartu Search Console.

Catatan: data Search Console terlambat ±2–3 hari. Sync bulan berjalan otomatis berhenti di 3 hari lalu (ada peringatan); sync ulang bulan sebelumnya setelah tanggal potong (tanggal 5) supaya datanya final. Query & halaman ditarik **top 1000** (urut klik, setara export XLSX Search Console; ubah `GSC_TOP_ROWS` di `src/modules/connectors/sources/gsc/index.ts` jika perlu, maks. 25.000 per request). Total klik, impressions, CTR, dan posisi rata-rata diambil dari total resmi properti.

### 5. YouTube

YouTube selalu memakai **login akun Google pemilik channel** (OAuth client yang sama dengan opsi B GA4).

1. Aktifkan tiga API: [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com), [YouTube Analytics API](https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com), [YouTube Reporting API](https://console.cloud.google.com/apis/library/youtubereporting.googleapis.com).
2. Halaman **Connectors API** → kartu YouTube → **Hubungkan akun Google** (atau buka `/api/auth/youtube`). Di layar pilih akun, pilih **akun / Brand Account channel Main ke Kudus**, lalu centang kedua izin YouTube.
3. **Test koneksi**: menampilkan nama channel, dan sekaligus mendaftarkan job laporan *Reach*.

Yang ditarik per bulan, sesuai definisi laporan YouTube (video yang dipublish di bulan itu, performa selama bulan itu):
- **Data API**: daftar video dari playlist uploads channel yang dipublish di bulan itu (tanggal WIB). **YouTube Shorts tidak dihitung** karena hanya mirror Reels, sama dengan filter "Long-form Videos" di Studio.
- **Analytics API**: views, watch time, average view duration, subscribers gained/lost, likes, comments, shares per video, plus views & watch time harian.
- **Impressions & CTR thumbnail**: metrik ini **tidak ada di Analytics API**, hanya di **Reporting API** (laporan `channel_reach_basic_a1`). Karena itu:
  - Saat job pertama dibuat, YouTube hanya menyediakan **30 hari ke belakang**, dan laporan pertama muncul ±2 hari kemudian.
  - Setiap laporan di API hanya bertahan **60 hari**, jadi dashboard menyimpan laporan harian ke database (`YtReachDaily`) setiap sync. Jalankan sync minimal sebulan sekali (cron tanggal 5 sudah cukup).
  - Bulan yang belum tercakup penuh tetap memakai impressions dari import CSV Studio sebelumnya, dan ada peringatan di riwayat sync.
- Unique viewers tidak tersedia di API YouTube (sudah dihapus Google), jadi kolom itu hanya terisi dari import CSV.

### 6. Meta (Instagram & Facebook)

Connector Meta memakai **Graph API `v26.0`** (konstanta `GRAPH_VERSION` di `src/modules/connectors/sources/meta/graph.ts`) dengan **token system user**, jadi tidak perlu login ulang dan token tidak kedaluwarsa.

1. **Buat app**: https://developers.facebook.com/apps → **Create app** → use case *Other* → tipe **Business** → pilih Business portfolio yang memiliki Page Main ke Kudus. App boleh tetap mode *Development* (hanya dipakai aset bisnis sendiri).
2. **System user**: https://business.facebook.com/settings → **Users → System users → Add** → nama mis. `mkk-dashboard`, role **Admin** (atau Employee).
3. **Assign aset** ke system user itu (**Assign assets**):
   - **Pages** → Page Main ke Kudus → akses penuh (*Manage Page* / Full control). Tanpa ini token tidak mendapat page access token.
   - **Instagram accounts** → `main_ke_kudus` → akses penuh.
   - **Apps** → app dari langkah 1 → *Manage app*.
4. **Generate token**: di system user → **Generate new token** → pilih app → *Token expiration*: **Never** → centang izin:
   `pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`, `instagram_manage_insights`, serta `pages_read_user_content` dan `business_management` (dokumentasi Meta mensyaratkan keduanya untuk `/posts` dan untuk `/media` saat akses Page didapat lewat Business Manager).
5. **ID**: Page ID ada di Page → *About → Page transparency*, atau Business Settings → Accounts → Pages. ID akun Instagram boleh dikosongkan — diambil otomatis dari `/{page-id}?fields=instagram_business_account`.
6. Isi `.env.local`, lalu restart `npm run dev`:
   ```
   META_ACCESS_TOKEN=EAA…          # token system user
   META_PAGE_ID=1234567890         # Page Facebook
   META_IG_USER_ID=                # opsional (1784…)
   META_APP_SECRET=                # opsional, wajib jika app mengaktifkan "Require App Secret"
   ```
7. **Test koneksi** di kartu Meta: menampilkan pemilik token, Page, akun IG (followers, jumlah post), sekaligus mencoba insight post terakhir dan mengecek izin yang kurang.

Platform yang dihitung diatur di `ACTIVE_SOCIAL_PLATFORMS` (`src/modules/shared/lib/sources.ts`). Saat ini hanya `instagram` — post Facebook tidak ditarik dan tidak dihitung; tambahkan `"facebook"` untuk mengaktifkannya lagi.

**Definisi angka di halaman Social (Instagram via API)** — KPI & tren memakai *insight akun selama bulan itu*, bukan jumlah metrik lifetime per post:

| KPI | Sumber API | Catatan |
|---|---|---|
| Views, Interactions | `/{ig-user-id}/insights` `views`, `total_interactions` (total_value) | Termasuk Stories & post lama. Diminta per potongan ≤ 30 hari lalu dijumlah → pas sebulan penuh |
| Reach | `reach` (akun unik) | Tidak bisa dijumlah; Meta membatasi maks. 30 hari per request → bulan 31 hari hanya 30 hari pertama (ada peringatan) |
| Engagement rate | interactions ÷ reach akun | Lebih tinggi dari ER per post karena pembaginya akun unik |
| Follows | `follows_and_unfollows` (breakdown `follow_type`, FOLLOWER) | Follow baru ke akun selama bulan itu; API tidak menyediakan follows per post untuk Reels |
| Views / post, top post, per format, per kategori | `/{media-id}/insights` | Metrik **lifetime** post yang dipublish bulan itu (sejak publish) |

Bulan lama hasil import CSV tetap memakai definisi lama (jumlah per post); MoM antar definisi berbeda tidak dihitung dan halaman memberi catatan.

**Views per post: bulan ini vs lifetime.** API Instagram hanya memberi metrik lifetime per post, jadi angka per post terus bertambah setiap sync. Dashboard menampilkan:
- **Views lifetime** dengan tanggal acuannya ("per 19 Okt 2026" = waktu sync post IG bulan itu).
- **Views bulan ini** = views s/d snapshot pertama setelah bulan selesai (`IgMediaSnapshot`, maks. 7 hari setelah tanggal 1). Snapshot diambil tiap sync Meta dan **sekali sehari** lewat cron (`SYNC_CRON=1`); snapshot pertama 19 Okt 2026, jadi kolom ini mulai ada untuk Oktober (setelah snapshot 1 Nov).
- **Per jenis konten · selama bulan ini** (tabel `IgAccountByType`): insight akun dengan breakdown `media_product_type` — views & reach Reels / Carousel / Foto / Story selama bulan itu (termasuk post lama yang masih ditonton). Angka per periode, tidak berubah saat sync ulang.

**Kunci bulan (Pengaturan → Connectors → Kunci bulan):** bulan terkunci tidak ditarik ulang oleh GA4, GSC, YouTube & Meta (Publishing Log tetap bisa di-sync), supaya angka laporan tidak berubah. **Tanggal potong (mulai Oktober 2026): tanggal 5 bulan berikutnya jam 07:00 WIB** (`CUTOFF_DAY` di `src/modules/shared/lib/month.ts`) — cron sync, mengunci bulan lalu, lalu membuat laporan. Metrik lifetime per post Instagram diambil dari snapshot tanggal 5 (`IgMediaSnapshot`) walau sync terlambat (server mati saat jadwal), supaya tiap bulan setara; snapshot tidak ada → angka saat sync + peringatan. Menarik ulang bulan terkunci: buka kunci di UI, atau `npm run sync -- --month=YYYY-MM --force`. Jul–Sep 2026 dikunci 19 Okt 2026.

**Story Instagram (hanya info, bukan KPI):** API Meta hanya memberi Story yang masih aktif (≤24 jam), jadi Story disimpan ke tabel `IgStory` setiap sync Meta dan **tiap 6 jam** saat `SYNC_CRON=1` (server harus menyala — Story yang kedaluwarsa saat server mati tidak bisa diambil lagi). Untuk bulan lalu / celah, import CSV Story dari Business Suite (Insight → Konten → filter Story → Ekspor) lewat halaman Import; terdeteksi otomatis sebagai *Meta · Instagram Stories*, upsert per ID (aman diulang, tidak menimpa post IG). Jam export Meta = Pacific Time → export 1 hari lebih lebar agar Story tepi bulan (WIB) ikut. Widget "Cek Publishing Log vs Instagram" menampilkan Story di log vs Story yang tayang di IG; angka IG termasuk repost & tiap frame, jadi kuota/KPI Story tetap dari Publishing Log. File CSV Story Jul–Sep ada di `data-samples/2026-0X/IG Stories *.csv`.

Yang ditarik per bulan (tanggal WIB, sama dengan import CSV):
- **Instagram**: `/{ig-user-id}/media` (Reels, Carousel, Feeds; Stories tidak tersedia di endpoint ini) → `/{media-id}/insights`: `reach, views, likes, comments, shares, saved, total_interactions` (+ `follows` untuk non-Reels). Metrik lama `impressions/plays/video_views` tidak dipakai karena sudah deprecated. Insight akun (`reach, views, total_interactions, accounts_engaged`, total satu bulan) disimpan sebagai metrik `ig_account_*`. `follower_count` tidak lagi terdokumentasi untuk rentang harian, jadi dilewati.
- **Facebook**: `/{page-id}/posts` → `/{post-id}/insights`: `post_media_view` (Views) dan `post_total_media_view_unique` (Reach). `post_impressions*` tidak berlaku lagi sejak v25, dan sejumlah metrik Page dicabut Meta 15 Juni 2026 — kalau Meta menolak sebuah metrik, metrik diminta satu per satu, yang ditolak dilewati dan muncul sebagai peringatan di riwayat sync (sync tidak gagal).
- Rate limit / error sementara di-retry otomatis dengan backoff.

Catatan:
- **Post kolaborasi** milik akun lain (yang muncul di export CSV) tidak ikut di API — memang tidak dihitung di dashboard.
- Metrik Meta bersifat *lifetime* dan bisa terlambat ±48 jam; sync ulang bulan lalu setelah awal bulan (cron tanggal 5).
- Bulan tanpa post tidak menimpa data lama (termasuk hasil import CSV).
- Reels Facebook mungkin tidak muncul di `/posts` (Meta memindahkannya ke edge `video_reels`); jika Facebook mulai aktif lagi, cek jumlah post di dashboard vs Meta Business Suite.

### 7. Google Sheets (Publishing Log)

Publishing Log dibaca langsung dari Google Drive — tidak perlu upload XLSX. Log News & Sosmed: **1 bulan = 1 file**, dicari otomatis berdasarkan nama + bulan (bahasa Inggris/Indonesia, mis. "September 2026" / "Oktober 2026"). Tracker: **1 file untuk semua bulan**.

| Log | Nama file yang dicari | Tab yang dibaca |
|---|---|---|
| News | `… News Content Logs - <Bulan> <Tahun>` | tab log (Planned Date, Judul Berita, Status, Submitted Date, Published Date, Link Berita, …) |
| Sosmed | `… Socmed Content Logs - <Bulan> <Tahun>` | tab log (Tanggal, Konten, Kategori, Channels, Type, Admin, Designer/Editor, Status) |
| Sosmed · in review | `… Social Media - Task Progress` | tab per bulan (Planned Date, Artikel, Status, Submitted Date, Published Date) |
| YouTube | `… Youtube Calendar Timeline` (satu-satunya log YouTube yang di-update tim) | tab `Summary` = video & tanggal tayang; tab `Tracker` (Gantt) = status harian → in review |

File di-export ke XLSX lewat Drive API lalu diparse. Jika ada beberapa file yang cocok, yang terakhir diubah dipakai (salinan "Copy of …" dikalahkan) dan ada peringatan. Tab Summary/Ref log bulanan dilewati. Tanggal artikel News = **Published Date** (artikel review/draft memakai Planned Date). Daftar file yang dipakai per bulan (dengan link) ada di halaman **Sumber Logs**.

**Delivered = published + in review** (News, Sosmed, YouTube), dengan in review = **snapshot akhir bulan**: konten yang diserahkan bulan itu dan per akhir bulan belum tayang (status Review/Reviewing/Submitted/Approved, atau Published dengan tanggal tayang bulan berikutnya). Dihitung dari tanggal, jadi angka bulan lalu tidak berubah walau status di-update belakangan. Konten yang menyeberang bulan sengaja dihitung dua kali: in review di bulan penyerahan, published di bulan tayang. YouTube: status tugas Video Editor di Gantt pada hari terakhir bulan (QC = cek internal, tidak dihitung).

Setup:
1. Aktifkan **Google Drive API**: https://console.cloud.google.com/apis/library/drive.googleapis.com
2. OAuth consent screen → **Data access** → tambahkan scope `…/auth/drive.readonly` (lihat semua file Google Drive — hanya baca; dibutuhkan untuk mencari file by nama & export ke XLSX).
3. Halaman **Connectors API** → kartu **Google Sheets** → **Hubungkan akun Google** → login dengan akun yang bisa membuka semua spreadsheet log (mis. pemilik log News dan akun yang dibagikan log Sosmed) → centang izin Drive.
4. **Test koneksi** menampilkan file log yang ditemukan untuk bulan ini & bulan lalu (✓/✗).

### 8. Menjalankan sync

- **Dari UI:** halaman *Connectors API* atau *Import Data* → **Sync bulan ini**, **Sync ulang** (pilih bulan), atau **Backfill 6 bulan**. Di Overview ada tombol **Sync [bulan yang sedang dilihat]**.
- **Dari terminal / cron:**
  ```bash
  npm run sync                         # bulan lalu (bulan penuh terakhir), semua connector yang siap
  npm run sync -- --month=2026-09      # bulan tertentu
  npm run sync -- --backfill=6         # 6 bulan terakhir
  npm run sync -- --connector=ga4      # connector tertentu
  ```
  Exit code 1 jika ada yang gagal. Contoh cron (macOS/Linux, tiap tanggal 5 jam 07:00):
  `0 7 5 * * cd /path/ke/dashboard && npm run sync >> sync.log 2>&1`
- **Otomatis saat server jalan:** isi `SYNC_CRON=1` lalu restart `npm run dev` / `npm start`. Server menyinkronkan **bulan lalu** setiap **tanggal 5 jam 07:00 WIB** (tanggal potong) dan menyimpan Story IG aktif tiap 6 jam (lewat `instrumentation.ts`, runtime Node.js saja). Kalau laptop mati saat jadwal, sync dijalankan begitu server menyala lagi; tiap jadwal hanya sekali (tercatat sebagai *cron* di Riwayat sync).
- Semua sync tercatat di **Riwayat sync** (halaman Connectors API), termasuk pesan error yang bisa ditindaklanjuti, mis. *"The service account hasn't been added to GA4 property …"*.

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
| Achievement News / Sosmed / YouTube | (Published + In review) ÷ kuota = "Delivered" di dashboard & ketiga report (kartu "Delivered vs quota", baris "In review" di tabel kategori; report Sosmed/YouTube juga mendaftar konten in review di Publishing Log). Published ÷ kuota ditampilkan terpisah di dashboard |
| Total views News | Jumlah views GA4 untuk URL artikel yang published bulan itu (exact match, tanpa trailing slash & query string) |
| Interaksi sosmed | IG: likes + comments + shares + saves · FB: kolom *Reactions, Comments and Shares* |
| Engagement rate sosmed | Interaksi ÷ reach (reach = jumlah reach per post) |
| MoM | Hanya dihitung jika bulan lalu punya data channel yang sama. Untuk sosmed hanya platform yang ada di kedua bulan yang dibandingkan |

---

## Rekomendasi

Engine ada di [`src/modules/recommendations/lib/recommendations.ts`](src/modules/recommendations/lib/recommendations.ts). Setiap rule berisi `id`, `channel`, `mom` (butuh data bulan lalu?), dan fungsi `run` yang mengembalikan prioritas (tinggi/sedang/rendah), judul, dan teks Bahasa Indonesia berisi angkanya. Rule `mom: true` otomatis dilewati jika data bulan lalu belum ada.

Rule yang tersedia: impressions GSC naik tapi CTR turun · query posisi 4–10 · halaman CTR rendah · engagement rate website turun >10% · perubahan sesi signifikan · ketergantungan satu sumber traffic · kuota artikel < 90% · kategori dengan views per artikel tertinggi · artikel tidak cocok GA4 / 0 views · hari tanpa artikel · views per artikel turun · CTR thumbnail YouTube < 4% · retensi video rendah · kuota video · views YouTube turun · kuota IG Reels/Carousel < 90% · engagement rate sosmed turun >10% per platform · format dengan reach/post jauh lebih tinggi (mis. Reels vs Feeds) · kategori sosmed terbaik · hari publish kosong berturut-turut.

Menambah rule: tambahkan objek baru ke array `RULES`. Data yang bisa dipakai ada di `ctx.cur` / `ctx.prev` (lihat tipe `MonthBundle` di `src/modules/channels/types/month-bundle.ts`). Halaman satu channel memakai `channelRecommendations(channel, …)` dengan data channel itu saja — rule hanya boleh membaca channel-nya sendiri.

---

## Struktur kode

```
docs/architecture/data-flow.md   kontrak alur data (wajib dibaca sebelum mengubah data flow) + audit; docs/*-data-flow.md per domain
prisma/schema.prisma        schema DB (portable SQLite ↔ PostgreSQL)
prisma/seed.ts              import ./data-samples
src/app/(dashboard)/        route halaman (tipis: teruskan ?m= ke modul) · src/app/api/ API route
src/modules/<domain>/<fitur>/   index → views → sections → queries → services → repositories (Prisma)
                                + mappers/ lib/ types/ components/ (lihat docs/architecture/data-flow.md)
  website/ news/ social/ youtube/   halaman channel + Publishing Log (ringkasan per channel = services/*-summary-service.ts)
  channels/                 MonthBundle, tren lintas channel, kuota konten
  overview/ report/         halaman Overview & Report (+ status laporan Google Sheets)
  team/                     Stories, Briefs, Pipeline, Contributors, Scorecard, Recap (sisi baca; ingest di team/ingest)
  import/ connectors/ source-logs/   Import (+ History), Connectors API (+ Sync History), Source Logs
  shared/                   resolusi bulan, input manual, kuota, helper murni, skeleton
  recommendations/lib/      engine rekomendasi (rule per channel)
  auth/                     login Tahap 0 (cookie bertanda tangan), crypto.ts = AES-256-GCM token OAuth
  shared/lib/sources.ts     katalog sumber, kuota default, field input manual (+ format, month, tz, taxonomy)
  import/parsers/           parser file → dataset
    tabular.ts              baca CSV (blok + komentar #), XLSX, ZIP
    headers.ts              pencocokan header fleksibel + alias
    values.ts               parse angka/persen/durasi/tanggal (en & id)
    ga4.ts gsc.ts youtube.ts meta.ts logs.ts
    index.ts                deteksi otomatis, merge, filter bulan
  import/ingest/commit.ts   simpan dataset (replace per bulan+sumber)
  connectors/sources/       connector API (GA4, …) → Dataset yang sama dengan parser CSV
    index.ts                registry + sync (SyncLog)
    ga4/map.ts              mapping response runReport → dataset (dites dengan fixture JSON)
    gsc/ youtube/           connector Search Console & YouTube (index.ts = fetch API, map.ts = mapping murni)
    meta/                   Graph API: graph.ts (client, retry, paginasi), errors.ts, map.ts, index.ts
    sheets/                 Publishing Log dari Google Drive: map.ts (cocokkan nama file + bulan), index.ts (export XLSX → parser)
  team/ingest/              sync Drive (Story/Brief), parser .docx, pencocokan TeamMatch
  report/pipeline/          laporan bulanan Google Sheets + PDF
src/lib/db.ts               Prisma client · src/lib/utils.ts + src/hooks/ = helper shadcn (tetap di sini, alias components.json)
scripts/sync.ts             npm run sync (tsx --conditions=react-server, karena service memakai server-only)
src/components/ui/          komponen shadcn/ui (hasil `npx shadcn add …`, jangan diedit kecuali perlu)
src/components/blocks.tsx   KPI card, delta MoM, tabel, empty state (di atas shadcn)
src/components/charts.tsx   grafik tren & breakdown (shadcn Chart + Recharts)
src/components/AppSidebar.tsx   navigasi (shadcn Sidebar)
tests/                      tes lama (parser, connector, laporan, team); tes baru di samping file: src/**/*.test.ts
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

- Untuk bulan tanpa Publishing Log, News tampil kosong dan kuota sosmed dihitung dari post Meta (tanpa Stories). Sejak connector Google Sheets, log Juli–September tersedia.
- Facebook sengaja tidak dihitung (`ACTIVE_SOCIAL_PLATFORMS = ["instagram"]`); data FB lama di database diabaikan.
- Impressions & CTR YouTube sebelum ±16 Sep 2026 dan unique viewers YouTube hanya ada dari export Studio lama (API tidak menyediakannya) — sync API mempertahankan nilai lama tersebut.
- "Views bulan ini" per post baru tersedia mulai Oktober 2026 (butuh snapshot setelah bulan selesai); Jul–Sep hanya lifetime.
- TikTok belum dimasukkan. Baris TikTok di publishing log tetap tersimpan, tanpa metrik performa.
- Batas "carousel maks 8 slide" belum dicek otomatis karena export Meta tidak memuat jumlah slide.
- Tanpa autentikasi, hanya untuk localhost.
