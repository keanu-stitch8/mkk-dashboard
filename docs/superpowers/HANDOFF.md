# Handoff — MKK Dashboard (per 2026-11-05: generator Period Reports terverifikasi)

Baca ini dulu di chat baru, lalu `README.md`, `AGENTS.md` (Next 16: baca `node_modules/next/dist/docs/` sebelum menulis kode Next), **`docs/architecture/data-flow.md`** (kontrak alur data), `docs/channels-data-flow.md` (baris Social = alur IG audience baru), `docs/team-data-flow.md`, dan memory (`report-deck-style`, `contributor-pay-per-content`, `ig-api-metric-availability`, `mkk-connector-decisions`, `ambiguous-not-true`, `plan-before-report-changes`).

## Titik lanjut terbaru — akhir sesi 5 November

- **Commit/push sesi 5 November:** pengguna sudah meminta "commit dan push" setelah menerima
  laporan YouTube Oktober yang diperbarui. Generator Period Reports, pelengkap follows CSV,
  penyelarasan snapshot cutoff, tes dan dokumen sesi ini disertakan dalam commit ke `main`.
  TypeScript, lint, **246 tes / 31 file**, serta build produksi webpack lulus pada pemeriksaan sebelum
  commit. Dua skrip sementara `.tmp-check` dipindahkan ke `/private/tmp/mkk-dashboard-20261105-precommit-checks/`.
  QA produksi: Monthly Reports, Period 1/2, Social Oktober dan YouTube Oktober HTTP 200. Semua tautan
  laporan bulanan cocok dengan riwayat terbaru DB; YouTube 3/4, Period 1 ready dengan cutoff 4 November,
  Period 2 masih diblokir. Server QA memakai port kosong dan sudah dihentikan; proses lain tidak disentuh.
  Riwayat DB sudah memiliki hasil generate bulanan lebih baru pada 17.25–17.30 WIB; tautan YouTube
  terbaru saat pemeriksaan ialah `13X0XI0MgF02zFN5vmpVv0oHRCzsouFPGlVFY9dh1Vew` (17.25 WIB).
  Catatan belum di-commit pada bagian riwayat di bawah menggambarkan status sebelum permintaan ini.
- **YouTube Monthly Report Oktober dibuat ulang setelah koreksi AND1:** hasil baru
  [Google Sheets](https://docs.google.com/spreadsheets/d/1VfDhtJgCq5HM8ZNuE7sypIDobliZkSd71S_gxeUYK5o/edit),
  [PDF](https://drive.google.com/file/d/13Jo41zzASF2DD9zdPafs1wB-Tg1nea1o/view).
  Generator memakai data dashboard: **3 / 4 delivered, 75%, sisa 1**, views **474**. Daftar Oktober
  hanya Soto Bu Djatmi, @Hom Hotel, dan Gokil Restaurant; AND1 masuk November. Readback Google Sheets
  memverifikasi KPI, perbandingan -25% dengan September, narasi 3 dari 4, dan tiga baris Publishing Log.
  File lama yang dibuka pengguna (`1jUplXYsoosmhbe-SP9am4SMfPEHp3VJCrFMmNaM6kgw`) adalah snapshot
  4 November sebelum koreksi; generator memberi nama berakhiran lama. Riwayat baru sukses tanpa warning.
  PDF hasil ekspor awal memecah tabel kategori menjadi halaman tambahan. PDF pada ID yang sama
  diekspor ulang dengan pemisah sebelum Production Series (baris 29) dan fit-to-page untuk kedua
  bagian Executive Summary, menjadi **5 halaman**. Isi sheet tetap hasil generator; tidak ada perubahan
  kode generator. Seluruh halaman awal dan kedua halaman ringkasan hasil perbaikan diperiksa visual.
- **YouTube AND1, koreksi pengguna:** Planned Date 16 Oktober, Publish Date **2 November**. API YouTube
  mengonfirmasi `ND8911R7Xvw` public, published `2026-11-02T12:10:31Z`; sheet Summary saat diperiksa
  juga sudah benar. Dashboard memakai salinan `yt_log` lama bertanggal 16 Oktober. Parser memang sudah
  memprioritaskan Publish Date. Hanya `yt_log` Oktober dan November ditarik ulang lewat parser/commit
  yang sama dengan connector; tidak mengubah sheet sumber. Kini Oktober **3 published**, November
  **1 published** (AND1), in review keduanya 0. Kuota tetap **4** sebagai target default, bukan jumlah
  video tayang. YtVideo, Metric YouTube, MonthLock dan Quota dibanding sebelum/sesudah dan identik.
- **KEPUTUSAN FINAL TERBARU:** pengguna meminta semua acuan posting mengikuti **tanggal penguncian**,
  yaitu tanggal **4 bulan berikutnya pukul 15.00 WIB**. Bukan tanggal 5, bukan akhir bulan, bukan 2 Nov.
  `social/shared/lib/post-snapshot-date.ts` kini mengembalikan `cutoffDate(month)` dari sumber `CUTOFF_DAY`.
  Period wrapper memakai helper yang sama untuk bulan penutup. Social dan Period mengutamakan record
  sync tersimpan pada tanggal cutoff, lalu snapshot harian tepat tanggal itu. Ini mencegah snapshot
  harian lebih awal pada hari yang sama mengganti hasil sync cutoff. Tanggal lain tidak menjadi fallback.
  Data akun tetap kalender bulan/period, dan follows CSV tetap punya provenance tanggal tersendiri.
- Hasil terakhir pengguna yang diperbarui langsung: deck `1MNKNMKACMCiirGnTDxLYxMSvB8R1I4z5yw_CXkAujFo`,
  PDF `1bPbsTRro9hIdSNtAH80sVrDBH2aYzWIG`. Tabel kategori, Top posts, studi kasus, evaluasi follows dan
  metodologi diselaraskan ke cutoff 4 Nov tanpa mengubah pilihan organic/target pengguna atau tautan chart.
  Readback memverifikasi 59 bagian teks yang diubah, PDF tetap 13 halaman, preview native slide 7 dan 9
  diperiksa dan terbaca utuh. Catatan riwayat `GeneratedReport` juga diselaraskan. TypeScript, lint,
  246 tes, build produksi dan QA HTTP Social/Period lulus. Server uji 3100 sudah dihentikan, skrip edit
  sementara sesi ini dihapus. Perubahan kode disertakan dalam commit sesi ini.
- Entok berdasarkan record cutoff **4 Nov**: **19.127 views, reach 12.707, likes 282, comments 22, shares
  324, saves 316, Profile visits 285, follows tercatat 277**. Social boleh menampilkan follows CSV 278
  dengan tanda/provenance; period mempertahankan follows 277 yang tersedia pada record cutoff.
- **Slide 7:** kategori sekarang menghitung hanya posting dengan views tersedia. Kolom Posts berisi
  terukur/total (News 32/55, Video 28/46, Teaser 6/10); views dan rata-rata memakai posting terukur saja,
  bukan menganggap yang hilang nol. Pada cutoff 4 Nov: News 204.313 / avg 6.385, Video 108.467 / avg 3.874,
  Teaser 19.471 / avg 3.245. Ada catatan cakupan dan tanggal. Top posts Social Oktober juga sudah tampil.
- Seluruh catatan 2 November / akhir bulan / blokir karena tidak ada post views di bawah adalah riwayat
  keputusan sebelumnya. Pengguna terakhir menegaskan konsistensi dengan jadwal cutoff yang sudah ada.
- **Keputusan terakhir menjelang pengiriman jam 16:** pengguna secara eksplisit memilih **snapshot
  posting 2 November 2026 untuk Period 1**, bukan 31 Oktober. Sudah diterapkan di `periodPostSnapshotDate`
  dan dipakai bersama oleh preview/generator. `postSnapshotDate` menjadi field kanonik untuk catatan
  dashboard, judul tabel Top posts, studi kasus dan metodologi. Angka akun/followers tetap Jul–Okt.
  Posting di luar Jul–Okt tidak ikut. Tidak mengambil snapshot 30 Oktober, 3/4/5 November sebagai
  pengganti. Sebanyak 66 dari 111 posting memiliki views pada 2 November; lainnya tetap `n/a`, sehingga
  agregat kategori yang tidak lengkap juga `n/a`. Top 5 memakai posting yang snapshot-nya tersedia.
- Entok snapshot 2 November: **18.432 views**, reach **12.266**, likes 269, comments 20, shares 313,
  saves 309; follows **278** dari CSV upload 5 November (export date unknown), Profile visits `n/a`.
  Total akun tetap **729.954 views**, followers akhir Oktober **2.254**, published **351**.
- Verifikasi terbaru: TypeScript, lint, **245 tes / 31 file**, build produksi lulus. Template Google
  dan Sheet sumber berhasil dibaca; rencana pengisian 13 slide / 135 bagian teks dengan data DB asli
  menampilkan tanggal 2 November dan Entok 18.432. QA HTTP produksi membuktikan catatan "2 November
  2026 snapshot, not 31 October 2026", metrik kasus yang sesuai dan tombol generate aktif; Period 2
  tetap diblokir karena belum selesai. Tidak menjalankan generate baru, pengguna ingin menekan tombol
  sendiri. File Google lama tidak diubah. Server uji 3100 dihentikan; dev 3000 tetap milik pengguna.
- Catatan keputusan `n/a`/31 Oktober di bawah adalah riwayat sebelum pengguna menyetujui 2 November.
- **Keputusan paling baru pengguna:** tetap tampilkan dan izinkan generate laporan Juli–Oktober dengan
  data akun yang tersedia. Kekosongan snapshot 31 Oktober sekarang hanya warning. Top posts dan studi
  kasus ditulis `n/a`, termasuk empat kartu metrik, dengan tanggal snapshot yang hilang dijelaskan.
  Jangan mengambil snapshot 30 Oktober atau November sebagai pengganti. Period belum selesai dan
  data akun empat bulan yang belum lengkap tetap diblokir. Ini menggantikan keputusan blokir di bawah.
- Verifikasi keputusan terbaru: TypeScript, lint, **242 tes / 31 file**, build produksi dan QA HTTP
  lulus. Period 1 menampilkan 729.954 views akun, 2.254 followers, 351 published, tombol generate aktif
  dan empat metrik studi kasus `n/a`; Period 2 tombolnya nonaktif dan API tetap HTTP 400. Rencana
  pengisian template dengan data DB asli berhasil untuk 13 slide, 115 bagian teks, Top Content dan
  Case study `n/a`. Tes kontrak memverifikasi nilai contoh pada tabel/kartu diganti. Tidak menjalankan
  generate Google pada pemeriksaan ini; deck/PDF lama dan baris riwayat tetap utuh. Browser otomatis
  tidak tersedia, jadi UI diperiksa lewat render HTML produksi. Server sementara 3100 sudah dihentikan.
- **Composio Instagram** kini ACTIVE untuk `@main_ke_kudus`, nama Mainkekudus.com, akun Creator,
  Instagram user ID `17841425896162511`. Akun koneksi `ca_X1a1XUIrXpst`. Email login tidak dikembalikan
  API, jadi `mainkekudus@gmail.com` belum bisa diverifikasi dari respons. Uji langsung membuktikan
  views/reach dapat dibaca, tetapi follows Reel ditolak untuk jenis media tersebut. Tool media insights
  hanya menerima period lifetime tanpa tanggal historis. Dashboard tetap memakai koneksi Meta langsung.
- **Koreksi berikutnya, 5 November:** pengguna meminta views memakai tanggal akhir bulan. Top posts bulan
  selesai kini diurutkan dari snapshot tepat pada hari terakhir bulan; Period Reports memakai hari terakhir
  period untuk semua metrik posting, tanpa fallback 30 Oktober/2 November. Tidak ada snapshot 31 Oktober
  di DB; ranking akhir Oktober kosong. Pada tahap ini generator Period 1 sempat diblokir; keputusan
  terbaru di atas sudah menggantikan blokir tersebut.
  Deck/PDF yang sudah dibuat belum diubah. `SYNC_CRON=1`, tetapi cron adalah timer dalam proses Next.js;
  snapshot harian hanya log console, sehingga sebab pasti celah 31 Oktober–1 November tidak tercatat di
  `SyncLog`. Jangan menganggap data 30 Oktober sebagai hasil akhir Oktober. Tanggal posting lengkap juga
  sudah ditambahkan pada pilihan case study, detail dashboard, dan rencana Slides/PDF baru.
- Validasi lanjutan koreksi akhir bulan: TypeScript, lint, **240 tes / 31 file**, build produksi
  `SYNC_CRON=0 npm run build -- --webpack`, render HTTP Period 1/2 dan Social Oktober lulus. Endpoint
  menghasilkan HTTP 400 untuk Period 1 (snapshot 31 Oktober tidak tersedia) dan Period 2 (belum selesai),
  tanpa membuat baris `GeneratedReport`. Social November menampilkan empty state karena belum ada data.
  Tidak ada perubahan deck, PDF, data sumber, atau kunci bulan pada pemeriksaan ini.
- Pekerjaan generator, revisi judul, pelengkap follows CSV, slide 8 dan studi kasus sudah selesai serta
  diverifikasi. **Disertakan dalam commit sesi ini** atas permintaan pengguna. Deploy kantor
  tetap ditunda. Tidak ada migrasi DB baru untuk generator atau CSV follows.
- Judul **Instagram Four-Month Performance Report**, tetap **13 slide**. Hasil terbaru adalah
  [deck hasil generator](https://docs.google.com/presentation/d/1DjrqSrgICzgolOW_CtpoxeldvLmh68Wo3dLKoTD9PVk/edit)
  dan [PDF yang sudah diselaraskan](https://drive.google.com/file/d/1Y4S9Ozypna0Oj21Eq5rbQH7w8PVCsnWV/view).
  [Sheet grafik salinan](https://docs.google.com/spreadsheets/d/1gA0YFSfX1kvHTi_bnhL4jMr-acQtfDvDBGhqD8eJ1C4/edit)
  tetap terpisah dari sumber master. ID deck lama di bagian historis adalah sumber, bukan hasil revisi terbaru.
- Pilihan final pengguna **opsi 2**: snapshot metrik utama tetap di dalam period; hanya follows kosong
  dilengkapi CSV dengan sumber/tanggal terpisah. Slide 8 sudah lengkap, termasuk Lim You **23** dan Entok
  **278**. Entok tetap **16.446 views** dari **30 Oktober**, dan Profile visits tetap `n/a` karena tidak
  tercatat pada snapshot itu. CSV sudah diimpor secara terpisah; data API dan kunci bulan tidak berubah.
- Pilihan studi kasus **maksimal 10**, diurutkan berdasarkan views dari posting **dalam period terpilih**,
  divalidasi di UI dan server. Period 2 tidak mengambil sampel Period 1. Studi kasus memakai empat metrik
  utama Views, Reach, Profile visits, Follows serta rincian likes/comments/shares/saves.
- Verifikasi akhir: TypeScript, lint, **234 tes / 30 file**, build produksi, QA HTTP dan pratinjau seluruh
  13 slide lulus. Server uji 3100 sudah dihentikan; tidak perlu mengulang pekerjaan yang sudah selesai.
  Rincian implementasi/provenance ada pada bagian revisi follows di bawah.

## Status

| Bagian | Status |
| --- | --- |
| Semua commit s/d `e63d68d` (Contributor dirombak) | ✅ di-push |
| **Rencana B — metrik IG baru** (lihat bawah) + 2 migrasi `20261104071718_ig_audience_metrics`, `20261104071912_ig_follower_snapshot_flows` | ✅ selesai & dicek (tsc, eslint, 211 tes, build, halaman); tercakup dalam commit yang memuat handoff ini |
| Cron 4 Nov 15:07: Okt di-sync + **Oktober dikunci** + scorecard Okt di-snapshot | ✅ |
| Scorecard Jul–Sep: Sheets+Drive di-sync ulang (perbaikan tracker pengguna masuk), `snapshotScorecard` Jul–Okt | ✅ (DB saja) |
| Deck laporan 4 bulanan **Period 1 (Jul–Oct 2026)** | ✅ jadi; Step 02 diputuskan "Maintain editorial diversity" dan sudah diterapkan (sesi lanjutan) |
| **Report / PDF → Period Reports** (`/report/periods`) | ✅ implementasi dan live generate Slides + PDF terverifikasi 5 Nov; disertakan dalam commit sesi ini |
| Deploy server kantor | ⏳ "nanti saja" kata pengguna (`prisma migrate deploy` sekarang 4 migrasi baru) |

**Perubahan kode dalam commit ini (semua sudah diverifikasi):**
- Connector Meta (`src/modules/connectors/sources/meta/{index,map}.ts`): `IgAccountMonth` (profile_views, website_clicks, likes, comments, shares, saves, reposts; views/reach per `follow_type`; bulan terkunci diisi sekali, tak ditimpa), `IgFollowerSnapshot` (followers + follows/unfollows sejak tgl 1, **sekali per hari — snapshot pertama tidak ditimpa**), per post `profileVisits`/`reposts` (Meta menolak `follows` & `profile_visits` untuk **Reels**).
- Halaman Social: section "Audience & discovery" (`social/overview/{lib,services,types}/social-audience*`, `components/social-audience.tsx`) + kolom Follows/Profile visits di Top posts.
- Overview: kartu "Instagram followers" memakai seri followers yang sama (`getIgFollowers`), fallback `ig_account_followersNow`.
- Scorecard: aset "not tracked" bila satu kelompok aset wajib kosong di semua cerita sebulan (`untrackedAssets`, Juli 2026) — tidak lagi 0%.
- Dokumen: `docs/channels-data-flow.md` (baris Social).
- Backfill Jun–Nov sudah dijalankan (DB). Angka: followers 4 Nov **2.274** (terkunci); akhir bulan estimasi Jun 97 · Jul 455 · Agu 1.114 · Sep 1.666 · Okt 2.254.

**Langkah berikutnya (chat baru mulai di sini):**
1. Perubahan 4 November sudah tercakup dalam commit `8b97e74`. Generator Period Reports dan pembaruan dokumen 5 November disertakan dalam commit sesi ini atas permintaan eksplisit pengguna untuk commit dan push. Perubahan berikutnya tetap menunggu instruksi commit baru.
2. **Step 02 sudah diputuskan dan diterapkan:** judul "Maintain editorial diversity", deskripsi "Keep sport central, with food, tourism & human interest." (diringkas agar muat di kartu; thumbnail final sudah diperiksa, teks terbaca utuh) Mengikuti maksud draft asli Mba Indah: olahraga sebagai identitas utama, tema lain memperluas pengalaman sports tourism. Keseimbangan tema belum diukur. Usulan Claude lama "Back to July's 45/month" gugur (45 = 21 feed + 19 Reels + 5 video Juli, bukan target client). **Klarifikasi terakhir pengguna mengoreksi pembacaan KPI sebelumnya:** asal KPI 30 Reels + 30 Carousel/bulan dan 60 News/bulan, tetapi Stories JUGA termasuk dalam penghitungan kuota, mengikuti dashboard. Jangan mengubah penghitungan/output-vs-quota menjadi hanya Reels + Carousel. Perubahan isi pada sesi lanjutan: dua kotak teks Step 02; angka dan narasi Output vs Quota dipertahankan. Readback membuktikan 13 slide dan urutannya tetap. Setelah itu pengguna meminta perbaikan layout slide 6 (Output vs Quota): kotak caption diperlebar dan ditinggikan, kalimat October dipisah ke baris kedua, line spacing caption + tiga kartu menjadi 90% (sebelumnya 100%); ukuran font tetap. Preview diperiksa.
3. Opsional: samakan template oranye (warna kartu muda→tua, kotak rounded) supaya Period 2 langsung rapi; hapus deck v1 (warm_orange) ke Trash bila pengguna setuju; tambah kolom **tema** di Socmed log bila tim mau mengukur keseimbangan tema.
4. Sisa lama: deploy server kantor; sisa kecil `docs/architecture/data-flow-audit.md`.
5. Generator **Report / PDF → Period Reports** sudah diimplementasikan dan diuji langsung 5 November. Detail ada pada bagian berikut dan `docs/superpowers/plans/2026-11-05-period-report-generator.md`.

## Generator Period Reports, 5 November

- Menu Monthly Reports → `/report`, Period Reports → `/report/periods`. Preview empat bulan, pilihan studi kasus, target followers/tanggal opsional, konfirmasi organic, generate Slides + PDF, dan riwayat hasil.
- Modul `src/modules/report/periods/` mengikuti alur route/view/section/query/service/repository + pure lib. POST `/api/reports/periods/generate` menjalankan outbound pipeline. Insight akun dan kuota memakai service dashboard; Stories termasuk; snapshot posting harus di dalam period; kategori, Top 5 dan studi kasus memakai dataset yang sama.
- Tidak ada perubahan struktur DB/migrasi baru. `GeneratedReport` dipakai dengan channel `social_period`, month = bulan penutup; diff schema hanya komentar. Generator memakai OAuth dashboard (Google Sheets + `drive.file`), bukan Composio atau LLM.
- Pengguna sudah mengaktifkan Google Slides API pada project dashboard. Preflight Drive/Slides sekarang berhasil. Default sumber adalah deck/Sheet Period 1 yang disetujui; override `REPORT_TEMPLATE_PERIOD_SLIDES`, `REPORT_TEMPLATE_PERIOD_CHARTS`, dan folder `REPORT_FOLDER_ID`.
- Live POST Period 1 menghasilkan HTTP 200 dan `GeneratedReport` sukses pada 5 Nov 12:39 WIB. **Hasil uji baru** (master asli tidak ditimpa): deck `1DjrqSrgICzgolOW_CtpoxeldvLmh68Wo3dLKoTD9PVk`, Sheet grafik `1gA0YFSfX1kvHTi_bnhL4jMr-acQtfDvDBGhqD8eJ1C4`, PDF `1Y4S9Ozypna0Oj21Eq5rbQH7w8PVCsnWV`.
- Readback memverifikasi 13 slide, 131 bagian teks dan ketiga chart terhubung ke Sheet baru. PDF diekspor dengan 13 halaman. Seluruh 13 pratinjau native diperiksa, termasuk slide 6; angka 2.254 followers, 729.954 views, 351 published/232 Stories/119 feed+Reels+video, kuota 240, Entok snapshot 30 Oktober tetap sesuai acuan. Warning tersisa hanya follows per posting tidak selalu tersedia.
- TypeScript, lint, 225 tes di 28 file, dan build `SYNC_CRON=0 npm run build -- --webpack` lulus. Browser otomatis tidak tersedia; UI diverifikasi melalui render HTML, deck melalui pratinjau native Google Slides.
- Halaman produksi diuji di port 3100 dengan password sementara pada env proses: Period 1 menampilkan deck/PDF dan riwayat sukses, Period 2 (November 2026–Februari 2027) terblokir karena belum selesai. Server uji sudah dihentikan. Tidak ada konfirmasi pasangan data tim yang diklik.
- Revisi judul atas permintaan pengguna: **Instagram Four-Month Performance Report**, untuk membedakannya
  dari laporan social media bulanan. Generator mengisi cover empat baris dengan font template tetap dan
  memakai judul ini untuk nama deck/Sheet/PDF. Hasil uji pada ID yang sama diperbarui, termasuk PDF.
  Sumber deck Period 1 yang disetujui tidak diubah.

## Revisi follows CSV dan studi kasus, 5 November siang

- Pengguna memilih **opsi kedua**: metrik utama tetap snapshot di dalam period, hanya follows yang kosong
  dilengkapi dari CSV lifetime dengan tanggal/sumber terpisah. Jangan mengubah views menjadi angka November.
- Upload CSV Instagram kini otomatis menjadi `meta_ig_follows` jika bulan sudah memiliki API Meta atau
  dikunci. Preview menjelaskan pelengkap follows; full replace ditolak pada bulan Instagram yang dikunci.
  Kolom tanggal export opsional. Jika tidak diketahui, tampilkan tanggal upload dan `export date unknown`,
  jangan memakai rentang publish pada nama file sebagai tanggal pengukuran.
- Storage tanpa migrasi: Breakdown social, dimension `instagram_post`, label = Post ID, metric = follows,
  milik Import source `meta_ig_follows`. Import.note mencatat tanggal export; Import.createdAt adalah upload.
  Sync API tidak menghapus sumber ini. Social overlay exact-ID membawa `followsRecorded` dan `followsCsv`;
  tanggal `postsAsOf` tetap dari import API. Laporan period mempertahankan follows in-period yang tersedia,
  lalu mengisi yang null dari CSV, ditandai `*` pada tabel dan dijelaskan pada metodologi.
- File pengguna `/Users/riski/Downloads/Oct-01-2026_Oct-31-2026_1058840090544555.csv` sudah dibaca dan diimpor
  sebagai **18 follows-only rows**. Arsip Agustus/September di data-samples melengkapi 24/31 baris. Tanggal
  export belum diketahui, jadi provenance = upload 5 November. Pengguna tidak perlu mengimpor ulang file
  tersebut untuk mendapatkan follows di laporan ini.
- Perbandingan dengan backup SQLite sebelum import membuktikan **89 Import non-pelengkap, 203 SocialPost,
  121 Metric, 1.123 IgMediaSnapshot, dan empat MonthLock identik**. Akun/per-post API tidak ditimpa.
- Slide 8 kini follows lengkap **235, 212, 23*, 278*, 1**. Lim You memakai CSV 23; Entok CSV 278. Views
  Entok tetap 16.446, reach 11.059, likes 248, comments 19, shares 284, saves 276, snapshot 30 Oktober.
- **Studi kasus maksimal 10 posting tertinggi berdasarkan views dari period yang dipilih.** UI dan server
  memakai daftar kanonik sama; ID di luar top 10 ditolak. Period 2 hanya November 2026–Februari 2027 dan
  saat ini tidak punya kandidat, tanpa fallback ke Period 1.
- Tetap 13 slide. Empat metrik studi kasus menjadi Views, Reach, Profile visits, Follows; likes/comments
  dan shares/saves menjadi rincian. Profile visits Entok tidak tercatat pada snapshot period, sehingga
  tetap n/a sesuai pilihan kedua. Deck/PDF hasil generator diperbarui pada ID yang sama (lihat bagian atas),
  sumber master tetap tidak diubah. Readback memverifikasi 135 bagian teks dan tiga chart tetap utuh.
- Rencana rinci: `docs/superpowers/plans/2026-11-05-instagram-csv-follows.md`. TypeScript, lint, 234 tes
  di 30 file, dan build produksi diverifikasi untuk revisi ini. Perubahan masih uncommitted.
- QA HTTP produksi port 3100 lulus: Period 1 menampilkan sumber CSV dan riwayat, Period 2 tidak membawa
  Entok, Social menandai pelengkap CSV. Preview file Oktober menghasilkan 18 baris follows-only dan
  penolakan full replace bulan terkunci; endpoint laporan menolak studi kasus dari period lain. Server uji
  sudah dihentikan, skrip pemeriksaan sesi ini dihapus. Seluruh 13 pratinjau native diperiksa; catatan sumber
  slide 8 berada di bawah tabel dan subjudul cover satu baris. Browser otomatis tetap tidak tersedia.

## Deck laporan 4 bulanan (Period 1, Jul–Oct 2026)

- Keputusan pengguna: **"Period N"** (bukan T1/tri semester; Period 2 = Nov 2026–Feb 2027), IG saja, teks EN + format angka ID, lewat **Composio** untuk hemat token. Sesi awal memakai Composio MCP (`pool`); sesi lanjutan memasang **Composio CLI v0.6.0** (`~/.local/bin/composio`), sudah login, toolkit `googleslides` terhubung. Pakai CLI yang sudah terpasang, simpan respons besar ke file dan tampilkan ringkasannya saja. Semua angka **dari data olahan dashboard** (dump via service `getSocialSummary`/`getSocialAudience`, bukan Insights app). Draft asli lengkap Mba Indah ditempel pengguna dalam sesi lanjutan; narasinya menjadi acuan, angka Insights ±30 hari tidak dicampur sebagai angka Jul–Okt.
- **Tujuan narasi (klarifikasi pengguna 4 Nov, sesi lanjutan):** rayakan pencapaian Jul–Okt sambil jujur mengenai tren realisasi produksi. KPI asal client 30 Reels + 30 Carousel dan 60 News setiap bulan; pengguna menegaskan Stories juga termasuk penghitungan kuota, **sesuai dashboard**. Scope deck tetap Instagram. Step 02 membahas keragaman editorial, bukan target volume baru.
- Folder Drive laporan bulanan: `1fpXnn7AFzH0hRWoIBtUeQ-EdDsxOOdgW`.
  - **Deck final:** "MKK Instagram Performance Report – Period 1 (Jul–Oct 2026)" `1unxVW_vYhscmcZJ-52f2r7CRVHThbTqbcGV92Ym-iM8` (13 slide: cover, exec summary 4 kartu, audience growth/views by type/output vs quota (kotak + grafik tertaut), tabel discoverability/kategori/top 5/profile→website, case study Entok, evaluation 6 poin, recommendations Step 01–05, methodology).
  - **Template bersih:** "MKK Report Template – Orange" `1d8gR6ZeIynCbR5LmmEcQY77li8JIqkXqJcjZoOGGhIw` (salinan template Slidesgo milik pengguna `1AmwkGDy…`, diwarnai ulang).
  - **Sheet grafik:** "MKK Instagram Period 1 (Jul–Oct 2026) – Chart Data" `1CfOyCYaP_dwGtQ0qtBeCBq_mo69K-2zvvAgI06BMLwI` (chartId 1106613600 followers, 1699083086 views per tipe, 1818551027 output vs kuota; rasio 960×260; locale `in_ID`).
  - Deck v1 lama (tema warm_orange, `1-XfWti4…`) masih ada — belum dihapus.
- Gaya yang diminta pengguna (lihat memory `report-deck-style`): palet putih/hitam/oranye; urutan **muda → tua** (`#FB923C #F97316 #EA580C #C2410C #9A3412`, 6 tingkat + `#7C2D12`); teks putih tidak boleh di atas krem; kotak **rounded dengan radius sama** di semua slide; tabel lebar sama & di tengah; subjudul cover 1 baris tanpa menabrak gambar; hindari elemen dekoratif yang terbaca sebagai data (pie Entok sudah dihapus); deskripsi harus eksplisit & berbasis data, bukan tafsiran.
- Fakta teknis Slides API (jangan ditemukan ulang): tidak bisa mengubah `shapeType` → rounded dibuat dari grup 2 persegi + 4 lingkaran (radius 110.000 EMU), kotak ber-teks dibuat transparan di atas grup; radius `ROUND_RECTANGLE` ikut ukuran shape (tidak konsisten); template Slidesgo menyimpan ikon/elemen tersembunyi di bawah kotak → hapus elemen di lapisan bawah saat kotak diganti; ikon putih memakai warna tema (bukan RGB); transform anak grup relatif terhadap grup; object ID ≥5 karakter; `updatePageElementsZOrder` per slide; gradasi tidak bisa diedit (ganti solid); grafik Sheets tertaut ikut rasio chart di Sheet; field mask `updateEmbeddedObjectPosition` = `anchorCell,widthPixels,heightPixels`; ganti teks dengan menyisipkan teks baru di awal tiap segmen lalu hapus sisa → gaya per baris tetap. Kerja massal lewat `COMPOSIO_REMOTE_WORKBENCH` (`proxy_execute` ke Slides API) + lembar kontak thumbnail untuk QA.

## Koreksi deck dan acuan master, sesi lanjutan 4 November malam

- Baca **`docs/superpowers/MKK-PERIOD-REPORT-GUIDE.md`** sebelum membuat laporan period berikutnya. Deck Period 1 menjadi acuan yang sudah disetujui; file Template Orange lama belum diperbarui dalam sesi ini.
- Period selalu empat bulan penuh dan penomoran berlanjut. Period 1 Juli–Oktober 2026, Period 2 November 2026–Februari 2027, Period 3 Maret–Juni 2027. **Data November tidak boleh masuk sebagai capaian Period 1.**
- Seluruh copy deck diperiksa dengan skill antislop copywriting. Teks Inggris sederhana, tanpa titik koma, titik dua, em/en dash, dan double hyphen. Nama bulan pada halaman terakhir lengkap. Baris kredit Slidesgo dihapus atas permintaan pengguna.
- Caption slide 3 disamakan dengan slide 6, dan slide 5 juga memakai kotak caption lebar. Jarak antarbaris 90%, tanpa mengecilkan huruf. Teks dicek lewat render dan thumbnail native.
- Grafik followers kini hanya Juli–Oktober. Ringkasan dan evaluasi memakai followers akhir Oktober **2.254 (estimasi)**, bukan 2.274 pada 4 November. Saldo pembuka Juli sekitar 97; net follows +2.157. Sisa target 3.000 menjadi 746, sekitar 12/hari sampai 31 Desember.
- Metrik posting Oktober sebelumnya lifetime sampai 4 November. Untuk deck ini diganti ke snapshot **30 Oktober**, snapshot terakhir yang tersedia di dalam period (31 Oktober tidak ada). Entok menjadi 16.446 views, reach 11.059, shares 284, saves 276, likes + comments 267. Follows belum tersedia pada snapshot tersebut, jadi kartu memakai Reach dan tabel Top 5 menulis n/a. Jangan mengembalikan 277 follows atau 19.127 views dari snapshot November ke laporan ini.
- Agregat kategori dan evaluasi ikut dihitung ulang. Featured News 260.614 views / 4.738 per post, Teaser 38.386 / 3.839, Featured Video 132.732 / 2.885. Insight akun kalender Juli–Oktober tetap 729.954 views, 11.166 profile visits, 231 link taps.
- Sheet grafik adalah file mandiri khusus laporan Period 1, bukan tracker atau DB dashboard. Peninjauan otomatis awalnya menolak pengosongan dua sel November, lalu mengizinkan setelah konteks file mandiri dan klarifikasi pengguna dibuktikan. `Sheet1!A7:B7` sudah dikosongkan dan diverifikasi; tidak ada blocker tersisa. Grafik followers memakai baris indeks 2 sampai 6 (eksklusif), yaitu Juli–Oktober.
- Untuk laporan berikutnya salin **deck dan Sheet grafik**, lalu sambungkan grafik ke Sheet baru. Jangan memperbarui Sheet Period 1 untuk period berikutnya karena dapat mengubah grafik laporan lama.
- Verifikasi akhir sesi ini selesai. Readback memastikan perubahan teks sesuai rencana, angka akun direkonsiliasi, grafik followers hanya empat bulan, sel November kosong. Seluruh 13 slide dirender, lalu slide 3, Entok, Recommendations, dan halaman terakhir juga diperiksa lewat thumbnail native Google Slides. Pengerjaan deck tidak mengubah kode/dashboard atau database. Perubahan kode Rencana B yang sudah ada beserta dokumen sesi ini tercakup dalam commit yang memuat handoff ini.

## Menu Contributor (dirombak 4 Nov, `e63d68d`)

Pengguna: kontributor lokal **dibayar per konten**; 1 konten = 1 artikel berstatus Submitted (foto/portrait/video/wawancara boleh tidak lengkap). Target 60/bulan nyata — pengguna sedang menyiapkan tim kontributor ke-2. Aturan mengikuti tab **"Master Report"** di tracker (rumus tim):

- **Tab "<Bulan> Extra Posts"** ikut dihitung (`isExtraTab`; id baris `<tab>#X<No>`, kolom `ContributorTask.extra`). Salinan seperti "September (old)" tetap diabaikan.
- **Kredit dibagi rata** antar penulis di Assignee Article (`articleCredit`, pemisah koma, "/", "&", "dan"); orang ber-Role "Footage" saja (tab Ref kolom C, sekarang YSR) tidak ikut dibagi dan dinilai dari **footage** = liputan yang minimal satu asetnya atas namanya (tanpa melihat status, sama seperti Master).
- **Cek otomatis:** `syncContributors` membaca tab Master Report (`readMasterReport`) dan memberi warning di Sync History kalau beda (`compareMasterReport`). Per 4 Nov Jul–Nov **sama persis** (total 31/55/42/29/1; Agu OEB 23,5 · FZ 6 setelah pengguna membetulkan "YZ" → FZ).
- **Tab Ref** (ditulis 4 Nov atas persetujuan pengguna): kolom F "News Name" (DN=Dani, HNR=Henri, ITN="Itun, Fatur", JMY=Jemmy, BRO=Abror, SBR=Subur), G "Active" (BRO & SBR = No), baris baru Subur (SBR, Role kosong). Kolom D–E = daftar dropdown status/aset, jangan disentuh. Tersimpan di `Contributor.role/newsNames/active`.
- **Halaman** (`src/modules/team/contributors/`): kartu Content delivered (Submitted ÷ 60, info "N with complete assets", "N extra") · **Articles → Website** = berita status publish bulan itu di News Content Logs (sama dengan report News) yang kolom Reporter-nya cocok alias / News Name (`reporterAliases`, tanpa tebakan; Redaksi MKK, RND, DV = bukan kontributor) — Okt 30 dari 31 · Carousel-ready / Reel-ready + "IG this month" = angka report Social (live dari Socmed log, in review dari Task Progress; Okt 9+5 carousel, 9+3 reel) · widget per orang (konten pecahan / footage, "X on web", aset; orang tidak aktif hanya tampil kalau ada kiriman) · tabel **Monthly recap** semua bulan + Total (`buildContributorRecap`, cocok dengan Master: total 158, OEB 61, JMY 31,33, ITN 29,5, FZ 19, DN 9,83, HNR 7,33, footage YSR 70).
- Sudah dihapus karena membingungkan pengguna: "Articles → IG" lewat rantai Story code (hanya 4 carousel) dan label "Web: needs confirmation" per baris (kolom Story di News log selalu kosong). Link "Live on web" per baris tetap (hanya sambungan pasti Content Pipeline).
- Efek samping yang disengaja: aset baris Extra Posts ikut ke Recap & Scorecard.
- Catatan pengguna: tanggal artikel jauh setelah aset itu wajar (kendala lapangan) — jangan ditandai; Assignee aset kosong (Okt #6, #13, #14) = kontributor malas mengisi, tidak memengaruhi bayaran.

**Perlu disampaikan ke tim (jangan ubah sheet sendiri — file Drive pengguna read-only):**
- Link Gokil Restaurant di Calendar Timeline (poin 4 di atas).
- Hanna Levina & Hydroplus Bitingan Masters memakai link IG yang sama (`DebtlUflDDZ`).
- "Batik Kudus Dikenalkan ke Atlet Mancanegara" masih Reviewing di tracker padahal reel 1 Sep ada di log.
- `260822_Timnas Hong Kong China Icip Jenang.docx` muncul 2x di tracker dan namanya tanpa kata "Brief" (tidak ter-sync).

**Keputusan terbuka (Riski + Mba Indah):** format kode Story `YYMMDD-N` + siapa yang menyalinnya ke log; siapa yang mengonfirmasi saran (usulan: Mba Indah); definisi story teaser (sekarang: IG story sebelum artikel tayang); target enam ukuran Scorecard; siapa saja yang boleh login.

## Struktur kode setelah refactor (ringkas — detail di `docs/architecture/data-flow.md`)

- **Render:** `src/app/(dashboard)/**/page.tsx` (8–10 baris, hanya normalisasi `?m`/`?show`/`?page`) → `src/modules/<domain>/<fitur>/index.tsx` → `views/` (Suspense) → `sections/` → `queries/` (React `cache()`) → `services/` (`import "server-only"`) → `repositories/` (Prisma saja) → `mappers/` (buang `importId`/`month`) → `lib/` (murni, dites) → `components/`.
- **Modul:** `website/ news/ social/ youtube/` (overview + logs), `channels/` (MonthBundle, tren, `contentQuota`), `overview/`, `report/`, `team/{shared,stories,briefs,pipeline,contributors,scorecard,recap}`, `import/{data,history}`, `connectors/{settings,history,shared}`, `source-logs/`, `shared/` (resolveMonth, input manual, kuota, helper, skeleton; tidak boleh impor modul fitur).
- **Ingest & pipeline di modul** (bukan lagi `src/lib`): `connectors/sources/` (sync, cron, `lock.ts`), `import/parsers/`, `import/ingest/commit.ts`, `team/ingest/` (sync Drive, parser .docx, `rebuildMatches`), laporan Sheets/PDF `report/pipeline/` (tanpa Prisma), rule engine `recommendations/lib/`, login `auth/`, helper `shared/lib/`. Di `src/lib` tinggal `db.ts` + `utils.ts`; `src/hooks/use-mobile.ts` tetap (alias shadcn).
- `src/lib/data` sudah **tidak ada**. Tempat baru yang sering dicari:
  - ringkasan channel: `src/modules/<ch>/overview/services/<ch>-summary-service.ts` + `lib/<ch>-summary.ts`
  - MonthBundle / tren / kuota: `src/modules/channels/`
  - pencocokan log ↔ post IG: `src/modules/social/shared/lib/social-match.ts`
  - Team baca: `src/modules/team/shared/{services,lib/team-links.ts}`; scorecard `src/modules/team/scorecard/{lib,services}`; Confirm / Not this: `team/shared/services/match-decision-service.ts`
  - thumbnail IG / og:image: `src/modules/social/shared/services/ig-thumb-service.ts`, `src/modules/news/logs/services/og-image-service.ts`
- Tidak ada `'use cache'` (pengecualian sengaja: angka harus berubah tepat setelah sync); halaman tetap `force-dynamic`.
- Error boundary: `src/app/(dashboard)/error.tsx` (Next 16: prop `retry`, bukan `reset`).

## Team Dashboard — cara kerjanya

- **Alur tim:** kontributor lokal Kudus → panduan liputan harian (Drive `.docx` "YYMMDD_PANDUAN LIPUTAN …", "Artikel N") → tim Bogor menulis artikel (News Content Logs) → Mba Indah (Content & Creative Manager) menulis brief (`YYMMDD_Brief Carousel/Reel - Topik.docx`) → editor (Nana carousel, Veno reel) → post IG (Socmed Content Logs).
- **Connector `drive`** (`src/modules/connectors/sources/drive`) = akun Google yang sama dengan connector Sheets. `syncMonth` menjalankan `syncTeamDocs` (Story + Brief bulan itu) → `syncBriefTracker` → `syncContributors` → `rebuildMatches`. Sync Sheets juga menjalankan `rebuildMatches`.
- **Sumber:**
  - Story ← panduan liputan (kode `YYMMDD-N`, duplikat diberi akhiran `b`). 9 panduan Jul–Sep format lama dilewati (warning di Sync History).
  - Brief ← nama file + outline `.docx` (`parseBriefName` longgar: `BRIEF CAROUSEL- …`, `Brief Reel-…`, `CREATIVE BRIEF …`, tanpa topik).
  - `BriefTask` ← "MKK Kudus Social Media - Task Progress" (`1-p5K4AGNVjcGUy8sMrn1rTs6IMrwzH0lQVhQun4NOjw`), disambung lewat `briefKey(nama file)`.
  - `ContributorTask` + `Contributor` ← "MKK Kudus Local Contributor - Task Progress" (`15LY6CsihTxJsHl7Zh2F1qUJ8bqY93TI2Wo8OOoYceOE`); 4 aset Available / Not Available / kosong; tab Ref = alias → nama, Role, News Name, Active; tab Master Report = pembanding (lihat bagian Menu Contributor). Jul–Nov terisi.
  - Kolom opsional "Story" di News & Socmed Logs → `NewsArticle.story` / `SocialLog.story` → status `coded` (sambungan pasti).
- **Pencocokan** (`src/modules/team/ingest/match.ts`, `src/modules/team/ingest/store.ts` → `TeamMatch`; status mesin `GENERATED_MATCH_STATUSES` dihapus & dibuat ulang tiap rebuild, `confirmed`/`rejected` tidak pernah ditimpa):
  - Run: story→article, brief→social (+ `withTracker`), brief→article, brief→story, igstory→article (`multiTo`), coded story→article/social.
  - Dihitung (`COUNTED`, urut bukti): confirmed > coded > tracker > auto. `suggested` = "Needs confirmation", tidak pernah dihitung.
  - auto: ≥3 kata sama, ≥60%, ≥2 kata langka, tanpa kandidat setara (setara → semua jadi suggested).
  - tracker: tanggal Task Progress ±1 hari **dan** judul sepakat. Tanggal saja → saran. Tracker bertentangan → auto turun jadi saran. Link IG dipakai 2 brief → tanda ⚠, link tidak dipakai.
  - Kontributor ↔ Story: hanya judul di hari panduan yang sama (≥2 kata, ≥50%, unik). Urutan baris bukan bukti.
- **Scorecard** (`src/modules/team/scorecard/lib/scorecard.ts`): repurpose rate ≥80%, artikel→turunan ≤7 hari, brief→tayang ≤3 hari, backlog ≤3, aset lengkap ≥70%, kuota 100% (target masih usulan). Mulai `SCORECARD_FROM` = Juli 2026 (bulan sebelumnya tampil keterangan). Snapshot `TeamScore` dibuat di `setMonthLock` (`src/modules/connectors/sources/lock.ts`), dihapus saat unlock.
- **Login** (`src/modules/auth/auth.ts`, `src/proxy.ts`): cookie `mkk_session` ditandatangani HMAC (tanpa DB), 30 hari, ganti password = semua sesi lama gugur, 10 percobaan / 15 menit per IP. Tanpa `DASHBOARD_PASSWORD`: terbuka di dev, tertutup di produksi. `currentUser()` di `src/modules/auth/session.ts`; nama dicatat di `TeamMatch.decidedBy`.

Angka terakhir (sync 23 Okt): 159 auto, 30 tracker, 329 saran. Oktober: 43 Story (6 artikel ketemu), 15 brief (8 posted, 5 in review); scorecard Okt repurpose 41,7% · backlog 12 · kuota 57,8%. Rekap 2026: 108 panduan, 199 artikel, 109 brief, 379 post IG. YouTube Oktober (sync 24 Okt): 3 video public, 233 views.

## Dokumen kunci

- `docs/architecture/data-flow.md` (kontrak), `docs/architecture/data-flow-audit.md` (sisa), `docs/{channels,youtube,team,operations}-data-flow.md` (per domain)
- `README.md` (Setup Connector, laporan bulanan, struktur kode), `AGENTS.md`
- Laporan bulanan: `docs/superpowers/specs/2026-10-19-report-generator-design.md`, `docs/superpowers/plans/2026-10-19-report-generator-website.md`
- Tes: `src/**/*.test.ts` (modul, di samping file) + `tests/` (ingest, parser, laporan, Team ingest, login). Kesetaraan rekomendasi halaman channel: `src/modules/channels/lib/channel-recommendations.test.ts`.

## Lingkungan

- Pengguna menjalankan sendiri `npm run dev` di port **3000**. Jangan matikan proses itu. Database: SQLite `prisma/dev.db` (Prisma 6.19).
- `.env` berisi kredensial Google OAuth, Meta (token system user, jangan pernah ditampilkan), `ENCRYPTION_KEY`, `SYNC_CRON`, `REPORT_TEMPLATE_*`. `DASHBOARD_PASSWORD` belum diisi di laptop (sengaja, dashboard lokal tetap terbuka).
- Bulan Jul–Sep 2026 dikunci (`MonthLock`); cron mengunci bulan lalu otomatis setelah sync sukses.

## Fakta teknis yang sudah terbukti (jangan ditemukan ulang)

- **Model/kolom Prisma baru atau folder dipindah** → dev server pengguna error ("Unknown field …") sampai di-restart. Auto mode **menolak** `kill` proses dev pengguna, dan Next menolak dev server kedua di repo yang sama → minta pengguna restart. Verifikasi sendiri pakai `npm run build && npx next start -p 3100`, lalu matikan.
- Cek cepat tanpa browser: `curl -s localhost:3000/team/contributors?m=2026-10`, buang tag, grep teks kartu; error server ada di `.next/dev/logs/next-development.log`.
- Script cek data sekali pakai: taruh di folder sementara di dalam repo (mis. `.tmp-check/x.mts`, import relatif `../src/...`), jalankan `npx tsx`, lalu hapus foldernya — tsx dari scratchpad gagal me-resolve alias/ESM.
- **Jangan hapus folder migrasi yang sudah diterapkan**: Prisma minta reset DB. **Jangan pernah reset.** Kalau terjadi: backup `dev.db`, drop tabel baru yang masih kosong + hapus barisnya di `_prisma_migrations`, lalu `migrate dev` lagi.
- **Type route basi** (`.next/types` / `.next/dev/types` menunjuk path lama) → hapus keduanya lalu `npx next typegen`.
- Next 16: `middleware` → `proxy.ts` (di `src/`); `PageProps<"/…">` / `RouteContext<"/api/…">` dari typegen; `params`/`searchParams` berupa Promise; `error.tsx` memakai `retry`.
- **`server-only`**: service/query/repository mengimpornya. Script tsx di luar Next wajib `--conditions=react-server` (sudah di `npm run sync|seed|inspect`). Vitest mengalias `server-only` ke modul kosong dan `@` ke `src` (`vitest.config.ts`).
- Rule rekomendasi boleh membaca `cur.month`: konteks `channelRecommendations` wajib membawa `month` (bug ini sempat lolos unit test, tertangkap perbandingan render).
- `ChartCard`/`TrendChart` butuh field `label` di setiap baris data. `KpiCard kind="rate"` mengharapkan pecahan 0–1. Tipe titik tren harus `type` (bukan `interface`) supaya diterima ChartCard.
- **Cara verifikasi refactor data** (dipakai untuk `36e16df`): (1) dump output service lama vs baru untuk semua bulan di `dev.db`, abaikan `id`/`importId`/`updatedAt`; (2) worktree commit lama di scratchpad (`git worktree add --detach`), `cp -cR node_modules` (Turbopack menolak node_modules yang di-symlink), `DATABASE_URL` absolut, build, jalankan port 3101 vs 3100 dengan `DASHBOARD_PASSWORD` sementara di env proses, bandingkan multiset kata tiap halaman (urutan bisa beda karena streaming). Di zsh, variabel berisi beberapa argumen curl tidak dipecah — tulis argumennya langsung.
- Script uji di luar repo: `npx tsx --conditions=react-server --env-file=.env <script>.mts` dengan import path absolut (`/Users/riski/Repo/dashboard/src/...`). Sync: `npm run sync -- --month=YYYY-MM --connector=youtube`. File export sementara jangan ditulis ke root repo.
- **YouTube re-upload:** connector hanya menyimpan video **public** (`splitByPrivacy` di `src/modules/connectors/sources/youtube/map.ts`); yang dilewati tercatat di Sync History. Thumbnail yang 404 tampil sebagai placeholder di Publishing Log.
- **Uji login**: `next start -p 3100` dengan `DASHBOARD_PASSWORD` sementara di env proses (jangan tulis ke `.env`), uji via curl; uji browser lewat **`127.0.0.1:3100`** (cookie tidak dibedakan per port). Chrome kadang memakan Enter setelah mengetik password — klik tombol Sign in.

## Cara kerja yang dipakai (ikuti lagi)

- **Jangan auto-commit**: biarkan uncommitted sampai pengguna bilang "commit". Commit langsung ke `main`, push hanya kalau diminta. Pesan commit bahasa Indonesia, diakhiri `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Kode data baru/diubah mengikuti `docs/architecture/data-flow.md` (lapisan yang tepat, tipe kanonik eksplisit, tes `lib/` di samping file) dan memperbarui dokumen domain + audit.
- Verifikasi sebelum lapor: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build` (cek exit code), plus lihat halamannya (build produksi port 3100). Untuk refactor: bandingkan dengan commit lama (lihat di atas).
- Hemat limit: potong output besar, dump ke file, baca bagian yang perlu saja; sarankan sesi baru + handoff ini kalau konteks panjang.

## Preferensi pengguna

- **Yang ambigu jangan dinyatakan benar.** Saran tetap "Needs confirmation" dan tidak dihitung; tombol Confirm di data asli = keputusan tim, jangan diklik saat tes.
- Bahasa Indonesia santai di chat; teks UI dashboard bahasa Inggris dengan format angka Indonesia.
- Semua data lewat API, tanpa biaya. shadcn: jangan edit `src/components/ui/*`, tambah lewat `npx shadcn add` + wrapper.
- Jangan tampilkan token/kredensial; jangan masukkan data pembayaran kontributor ke halaman yang dipublikasikan.

## Verifikasi ulang sebelum commit, 4 November malam

- `npx tsc --noEmit`, `npm run lint`, dan 211 tes di 25 file lulus.
- Build produksi lulus dengan `SYNC_CRON=0 npm run build -- --webpack`. Turbopack terhalang izin membuka port worker CSS pada lingkungan agen, termasuk saat eskalasi; skrip build project tidak diubah.
- Server produksi sementara port 3100 berhasil merender Social Oktober (Audience & discovery, followers 2.254), Overview Oktober (followers yang sama), dan Scorecard Juli (aset not tracked). Server uji sudah dihentikan; dev server pengguna port 3000 tidak disentuh.
