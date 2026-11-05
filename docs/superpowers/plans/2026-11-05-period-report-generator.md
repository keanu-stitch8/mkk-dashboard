# Generator laporan period Instagram

Lanjutan setelah commit `8b97e74`. Pengguna meminta generator deck tersedia pada menu Report / PDF.

## Status per 5 November 2026

**KEPUTUSAN FINAL:** tanggal acuan mengikuti **cutoff penguncian, tanggal 4 bulan berikutnya**.
Social Oktober dan Period 1 memakai 4 November, memprioritaskan record sync cutoff jika tersedia,
lalu snapshot tepat tanggal tersebut. Data akun tetap Juli–Oktober. Entok menjadi 19.127 views dan
285 profile visits. Kategori pada slide 7 memakai posting dengan views tercatat, disertai cakupan
terukur/total dan rata-rata berdasarkan posting terukur saja. Tanggal 2 November di bawah adalah riwayat.
TypeScript, lint, 246 tes dan build produksi lulus. QA HTTP membuktikan Social dan Period sama-sama
memakai cutoff 4 November. Deck/PDF terbaru telah diselaraskan pada ID yang sama.

**Keputusan paling baru:** Period 1 memakai snapshot posting **2 November 2026** atas permintaan pengguna.
Data akun tetap Juli–Oktober. Tanggal snapshot dan kemungkinan aktivitas setelah akhir period ditulis di
dashboard, tabel Top posts, studi kasus dan metodologi. Entok menjadi 18.432 views. Posting tanpa snapshot
2 November tetap `n/a`. Pilihan ini terpusat di `periodPostSnapshotDate`; period berikutnya tetap tanggal
akhir period. Kebijakan ini menggantikan pembatasan snapshot Period 1 ke 31 Oktober di catatan sebelumnya.

Keputusan terbaru pengguna: laporan Juli–Oktober tetap ditampilkan dan boleh dibuat dari data akun
yang tersedia. Metrik posting tetap memakai snapshot tepat pada hari terakhir period, tanpa fallback
ke snapshot sebelum/sesudahnya. Jika snapshot itu hilang, Top posts dan case study ditulis `n/a`
disertai penjelasan, bukan memblokir seluruh laporan. Period belum selesai atau data akun empat bulan
belum lengkap tetap diblokir. Deck/PDF hasil uji sebelumnya tetap menjadi artefak historis.

Validasi revisi ini: TypeScript, lint, 242 tes di 31 file dan build produksi lulus. QA HTTP membuktikan
Period 1 siap generate dan metrik studi kasus `n/a`, sedangkan Period 2 tetap nonaktif/HTTP 400.
Data DB asli juga berhasil melewati rencana pengisian 13 slide tanpa kandidat case study. Tidak membuat
file Google baru pada pemeriksaan ini; riwayat laporan tetap sama.

Hasil uji sebelum koreksi tanggal:

Implementasi selesai, belum di-commit. TypeScript, lint, 225 tes di 28 file, dan build produksi lulus.
Pengguna telah mengaktifkan Google Slides API. Uji POST Period 1 menghasilkan status sukses,
deck/PDF 13 halaman dan Sheet grafik baru. Readback memverifikasi 131 bagian teks serta ketiga
chart terhubung ke Sheet salinan. Seluruh pratinjau native slide diperiksa.

Artefak uji: deck `1DjrqSrgICzgolOW_CtpoxeldvLmh68Wo3dLKoTD9PVk`,
Sheet `1gA0YFSfX1kvHTi_bnhL4jMr-acQtfDvDBGhqD8eJ1C4`,
PDF `1Y4S9Ozypna0Oj21Eq5rbQH7w8PVCsnWV`. Master dan laporan sebelumnya tetap utuh.

## Hasil yang dituju

- Submenu Monthly Reports menuju `/report`, dan Period Reports menuju `/report/periods`.
- Pemilihan Period N, pratinjau data empat bulan, pilihan studi kasus, serta target followers opsional.
- Generate membuat salinan deck dan Sheet grafik, mengisi data, menautkan ulang grafik ke Sheet salinan, mengekspor PDF, dan mencatat hasil pada riwayat.
- Template dan laporan yang sudah ada tidak diubah. Tidak ada penambahan atau penghapusan baris pada master sumber.

## Batas data

- Period 1 Juli sampai Oktober 2026, lalu bergeser empat bulan. Hitung tanggal akhir kalender dan tahun kabisat.
- Gunakan service dashboard yang sama untuk insight akun, followers, kuota dan traffic website.
- Post dipilih berdasarkan tanggal publish di dalam period. Gunakan seluruh kelompok metrik dari snapshot tepat pada hari terakhir period, atau metrik tersimpan bila tanggal pengukurannya tepat pada hari tersebut. Jangan menggantikan snapshot akhir period dengan tanggal sebelumnya maupun sesudahnya.
- Data yang tidak tersedia tetap null/n/a. Rekonsiliasi kategori, Top 5, studi kasus dan evaluasi dari kumpulan post yang sama.
- Stories tetap dihitung dalam kuota, mengikuti dashboard. Jangan menjumlah reach bulanan sebagai unique reach period.

## Implementasi

- Modul baru `report/periods` mengikuti route → view → section → query → service → repository dan pure lib.
- Gunakan `GeneratedReport` yang ada, dengan channel `social_period` dan `month` berisi bulan penutup period. Tidak perlu migrasi atau restart Prisma.
- Google Drive/Sheets memakai OAuth dashboard yang sudah terhubung. Google Slides menerima izin `drive.file` untuk salinan buatan app. API Slides perlu diaktifkan pada project Google dashboard.
- ID sumber dapat dikonfigurasi lewat `REPORT_TEMPLATE_PERIOD_SLIDES` dan `REPORT_TEMPLATE_PERIOD_CHARTS`, dengan deck/Sheet Period 1 yang disetujui sebagai default.
- Periksa struktur master sebelum menyalin, tulis hanya pada salinan, lalu verifikasi hasil sebelum mencatat sukses. Laporan lama tidak dihapus atau diubah.
- Teks otomatis berbasis aturan dan angka yang tersedia. Tidak ada panggilan LLM atau biaya AI. Pertahankan gaya antislop yang disepakati.

## Verifikasi

- Tes kalender lintas tahun/tahun kabisat, penolakan tanggal di luar period, pemilihan snapshot, propagasi null, angka kategori, dan target.
- Tes kontrak pengisian template agar tidak ada tanggal atau angka contoh yang tertinggal dan grafik tidak lagi menaut ke Sheet master.
- TypeScript, lint, seluruh tes, build produksi dan pemeriksaan halaman.
- Uji API Google pada file baru khusus sesi ini. Catat ID artefak yang dibuat dan jangan membersihkan file pengguna.
