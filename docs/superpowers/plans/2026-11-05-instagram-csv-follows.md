# Pelengkap follows Instagram dari CSV

Pengguna menemukan warning bahwa CSV Oktober akan mengganti import API Meta. Parser sudah membaca
kolom Follows termasuk untuk Reels, tetapi source yang sama membuat import CSV menghapus metrik akun
API dan sync API berikutnya menghapus follows CSV.

## Perubahan yang dituju

- Upload Instagram CSV pada bulan yang memiliki data API default ke follows-only. Preview menjelaskan
  data pelengkap dan tidak menyatakan bahwa import API akan diganti. Pilihan full replacement tetap
  eksplisit, serta tidak diizinkan untuk data Instagram bulan yang dikunci.
- Simpan pelengkap pada import/source `meta_ig_follows`, berupa Breakdown social berdimensi Post ID,
  dengan metrik follows. Ini data panjang per media, tidak menambah SocialPost atau menggandakan kuota.
  Provenance tanggal export (opsional, unknown bila belum diketahui) dan tanggal upload dicatat terpisah.
  Tidak perlu migrasi DB.
- Overlay hanya follows per Instagram Post ID yang sama; views, metrik akun, snapshot dan month lock
  tidak berubah. Sync API tidak menulis source pelengkap, dan menghapus import pelengkap mengembalikan
  fallback API. Sel kosong tidak diubah menjadi nol.
- Laporan period membedakan tanggal metrik utama dan follows. **Pengguna memilih opsi kedua:** hanya
  follows yang kosong dilengkapi CSV terbaru; tanggal/sumber wajib ditulis pada tabel dan metodologi.
  Perubahan report harus tetap menggunakan snapshot in-period untuk views/metrik lain.

## Verifikasi

- Parser/preview dan commit: follows per Reel, nol versus kosong, filter bulan, duplikat/konflik Post ID,
  perlindungan import API dan bulan terkunci, serta source pelengkap tidak dihapus sync.
- Overlay: kecocokan ID dan platform tepat, provenance CSV, fallback API, metrik utama tetap sama.
- Report: tanggal follows eksplisit, snapshot utama tetap in-period, semua pemakai follows konsisten.
- TypeScript, lint, seluruh tes, build dan halaman produksi. Tanggal export opsional tetapi tidak boleh
  ditebak; jika kosong, tampilkan tanggal upload dengan catatan export date unknown.

## Hasil data dan deck

- CSV Oktober dari Downloads (nama file yang diberikan pengguna) mengisi 18 baris follows. Arsip CSV
  Agustus dan September di data-samples melengkapi 24 dan 31 baris. Nol dipertahankan; baris di luar bulan
  diabaikan. Tidak menyalin seluruh file ke repo.
- Dibanding backup SQLite sebelum import: 89 Import sumber lain, 203 SocialPost, 121 Metric, 1.123
  IgMediaSnapshot dan empat MonthLock identik. Export date tidak diketahui, dicatat sebagai upload 5 Nov.
- Top 5 slide 8 kini follows 235, 212, 23*, 278*, 1. Tanda * = pelengkap CSV dengan catatan tanggal.
  Views Entok tetap 16.446 dari 30 Oktober. Profile visits tidak ada pada snapshot itu dan tetap n/a.
- Studi kasus hanya memakai 10 posting dengan views tertinggi di period terpilih; ID di luar daftar
  ditolak server. Period 2 saat ini belum punya kandidat, tanpa fallback ke Period 1.
- Deck/PDF hasil generator diperbarui pada ID yang sama, tetap 13 slide dan chart workbook tetap terpisah.
- TypeScript, lint, 234 tes di 30 file dan build produksi lulus. Seluruh 13 pratinjau native diperiksa,
  catatan slide 8 diposisikan di bawah tabel, dan font subjudul cover dipertahankan agar satu baris.
