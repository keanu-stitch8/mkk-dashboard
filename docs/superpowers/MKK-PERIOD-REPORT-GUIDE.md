# Acuan laporan Instagram MKK per period

Keputusan pengguna pada 4 November 2026. Deck Period 1 yang sudah dirapikan menjadi acuan isi dan visual untuk laporan berikutnya.

## Kalender

Setiap period mencakup empat bulan kalender penuh, dengan penomoran berlanjut.

| Period | Rentang |
| --- | --- |
| 1 | 1 Juli sampai 31 Oktober 2026 |
| 2 | 1 November 2026 sampai 28 Februari 2027 |
| 3 | 1 Maret sampai 30 Juni 2027 |
| 4 | 1 Juli sampai 31 Oktober 2027 |

Hitung tanggal terakhir dari bulan penutup, termasuk tahun kabisat. Data period berikutnya tidak boleh masuk sebagai capaian period sebelumnya.

## File acuan

- Deck Period 1 `1unxVW_vYhscmcZJ-52f2r7CRVHThbTqbcGV92Ym-iM8`.
- Sheet grafik khusus Period 1 `1CfOyCYaP_dwGtQ0qtBeCBq_mo69K-2zvvAgI06BMLwI`.
- Template Orange lama `1d8gR6ZeIynCbR5LmmEcQY77li8JIqkXqJcjZoOGGhIw` belum disamakan dalam sesi ini. Jangan menyebutnya master final yang sudah diperbarui.

Untuk period berikutnya, salin deck dan Sheet grafik menjadi file baru. Arahkan grafik pada deck baru ke Sheet baru dan verifikasi ID sumbernya. Mengganti data pada Sheet Period 1 dapat mengubah grafik laporan lama saat di-refresh. Jangan menimpa file laporan yang sudah selesai.

## Kontrak angka

1. Angka akun berasal dari `getSocialSummary` dan `getSocialAudience`, dengan empat bulan period yang dipilih secara eksplisit. Waktu sync setelah period berakhir tidak berarti insight akun bulan tersebut mencakup aktivitas bulan berikutnya.
2. Followers adalah saldo akhir bulan penutup, bukan followers terbaru saat laporan dibuat. Gunakan seri bersama dashboard. Beri label estimasi bila hasilnya rekonstruksi. Snapshot sesudah period hanya dapat menjadi jangkar rekonstruksi setelah seluruh perubahan sesudah batas period dikeluarkan, bukan titik capaian tambahan pada grafik.
3. Grafik followers menampilkan empat bulan period. Saldo pembuka boleh disebut sebagai konteks perhitungan pertumbuhan, dengan tanggal yang jelas.
4. Angka per posting bersifat lifetime pada tanggal akhir period. Sesuai koreksi pengguna 5 November, gunakan snapshot tepat pada hari terakhir bulan penutup untuk seluruh posting, kategori, peringkat, dan case study. Snapshot sebelumnya maupun cutoff dashboard tanggal 4 bulan berikutnya tidak menjadi pengganti. Tanpa snapshot akhir bulan, metrik tetap `n/a`. Sesuai keputusan lanjutan pengguna, laporan tetap boleh dibuat dari data akun Juli–Oktober yang tersedia; Top posts dan case study ditulis `n/a` dengan penjelasan tanggal snapshot yang hilang. Jangan memblokir seluruh laporan karena metrik posting kosong. Period belum selesai atau data akun bulanan belum lengkap tetap diblokir. Angka historis 30 Oktober di bawah hanya catatan pemeriksaan, bukan data akhir Oktober.
5. Metrik yang tidak tersedia ditulis `n/a`. Jangan mengambil angka sesudah batas period untuk mengisi
   metrik utama. **Pengecualian yang disetujui pengguna 5 November:** follows yang kosong boleh dilengkapi
   dari CSV lifetime, termasuk angka sesudah period. Angka ini diberi tanda dan sumber/tanggal terpisah
   di slide 8, studi kasus, dan metodologi. Tanggal export yang tidak diketahui tidak boleh ditebak dari
   rentang publish pada nama file; tulis tanggal upload dan jelaskan tanggal export tidak diketahui.
   API Meta tidak menyediakan follows atau profile visits per Reel, tetapi CSV dapat memuat follows.
6. Setelah basis metrik posting berubah, hitung ulang semua pemakainya sekaligus, termasuk agregat kategori, views per post, peringkat Top 5, studi kasus, dan evaluasi. Jangan hanya mengganti satu kartu.
7. Kategori Publishing Log bukan tema editorial. Keragaman tema dapat didukung contoh konten, tetapi tidak boleh disebut seimbang tanpa pengukuran tema.
8. Penghitungan kuota mengikuti dashboard. Pengguna menegaskan Stories termasuk. KPI asal client 30 Reels + 30 Carousel dan 60 News per bulan tetap menjadi konteks kontrak, tetapi jangan mengubah agregat deck menjadi hanya Reels + Carousel. Scope deck ini Instagram.
9. Target masa depan diberi konteks sebagai rekomendasi. Selisih menuju target dihitung dari saldo akhir period, bukan saldo terbaru sesudah period.
10. Pilihan studi kasus maksimal 10 posting dengan views tertinggi dari period yang sedang dipilih.
    Validasi ini berlaku pada UI dan server. Period 2 hanya memakai tanggal publish November 2026–Februari
    2027; tidak ada fallback ke posting Period 1 jika data Period 2 masih kosong.

## Narasi dan visual

- Judul cover laporan period adalah `Instagram Four-Month Performance Report`, agar berbeda dari
  laporan social media bulanan. Nama file memakai judul yang sama, diikuti `Period N` dan rentang bulan.
  Generator mengisi judul ini pada salinan; judul lama pada sumber tidak perlu diubah. Cover tetap memakai
  font template dengan empat baris judul dan kotak subjudul dipindah ke bawah agar tidak bertabrakan.
- Rayakan pencapaian audiens dan konten yang memiliki bukti, sambil tetap menyampaikan tren realisasi produksi.
- Gunakan bahasa Inggris sederhana dan format angka Indonesia. Hindari titik koma, titik dua, em dash, en dash, dan double hyphen pada teks slide. Nama bulan pada halaman terakhir ditulis lengkap.
- Step 02 membahas keragaman editorial. Judul `Maintain editorial diversity`, deskripsi saat ini `Keep sport central, with food, tourism & human interest.` Jangan mengganti target menjadi realisasi Juli 45 posting.
- Jangan membawa baris kredit Slidesgo yang diminta pengguna dihapus ke laporan berikutnya.
- Pertahankan palet oranye muda ke tua, jenis huruf, radius kartu, dan lebar tabel yang sudah disetujui.
- Caption slide 3, 5, dan 6 memakai kotak lebar yang sama. Pada ukuran internal 3.000.000 EMU, transform kotaknya `scaleX=2.6667`, `scaleY=0.1733`, `translateX=572000`, `translateY=4390000`, dengan jarak antarbaris 90%. Angka ini berlaku pada komposisi dan ukuran slide acuan ini.
- Ringkas teks terlebih dahulu bila tidak muat. Pertahankan ukuran huruf dan periksa hasil native Google Slides.
- Revisi susunan tetap 13 slide. Studi kasus memakai Views, Reach, Profile visits, dan Follows sebagai
  empat metrik utama; likes/comments serta shares/saves menjadi rincian di bawah. Profile visits yang
  tidak tercatat pada snapshot period tetap `n/a`, bukan diisi dengan angka November.

## Pemeriksaan sebelum selesai

- Cocokkan judul period, bulan pada grafik, empat bulan data, dan tanggal acuan setiap metrik.
- Rekonsiliasi jumlah views, net follows, profile visits, link taps, output, kuota, tabel kategori, dan angka yang berulang antar-slide.
- Periksa bahwa grafik baru terhubung ke Sheet period yang tepat.
- Baca kembali seluruh teks, termasuk grup dan sel tabel. Periksa angka serta tanggal lama yang tertinggal.
- Render seluruh deck dan periksa tampilan native pada bagian yang berubah atau sempit. Pastikan tidak ada teks terpotong, baris tunggal yang menggantung, atau konten bertabrakan.
- Perbarui handoff setelah semua perbaikan selesai. Jangan auto-commit.

## Angka Period 1 setelah koreksi batas period

**KEPUTUSAN FINAL:** metrik posting mengikuti cutoff penguncian **4 November 2026**. Aturan bersama
untuk Social dan Period Report memakai tanggal 4 bulan berikutnya, bukan 2 November atau hari terakhir
bulan. Record sync tersimpan pada tanggal cutoff diprioritaskan atas snapshot harian lebih awal di hari
yang sama. Data akun tetap Juli–Oktober. Entok 19.127 views, reach 12.707, likes 282, comments 22,
shares 324, saves 316, profile visits 285, follows cutoff 277. Follows CSV memiliki tanggal terpisah.
Kategori slide 7 memperlihatkan terukur/total; views dan rata-rata hanya untuk posting terukur.
Pernyataan final ini menggantikan keputusan historis tentang 31 Oktober dan 2 November di bawah/atas.

**Keputusan terakhir pengguna 5 November:** untuk laporan yang akan dikirim, metrik posting memakai
snapshot **2 November 2026**, bukan 31 Oktober. Data akun tetap empat bulan Juli–Oktober. Catatan
tanggal dan kemungkinan aktivitas setelah Oktober wajib terlihat di dashboard, Top posts, studi kasus,
dan metodologi deck/PDF. Ini pengecualian eksplisit atas aturan akhir period di atas, hanya untuk Period 1.
Posting yang tidak memiliki snapshot tanggal itu tetap `n/a`; jangan mencampur dengan snapshot lain.
Entok pada snapshot 2 November: 18.432 views, reach 12.266, likes 269, comments 20, shares 313, saves 309.
Follows 278 tetap pelengkap CSV upload 5 November dengan tanggal export tidak diketahui; Profile visits `n/a`.

Catatan angka sebelum pengecualian 2 November:

- Followers akhir Oktober 2.254, estimasi. Saldo pembuka Juli sekitar 97. Net follows selama period +2.157.
- Account views 729.954, profile visits 11.166, bio link taps 231.
- Snapshot posting Oktober terakhir yang tersedia di dalam period adalah 30 Oktober. Tidak ada snapshot 31 Oktober.
- Entok pada 30 Oktober mendapat 16.446 views, reach 11.059, 284 shares, 276 saves, dan 267 likes + comments. Follows pada snapshot tersebut tidak tersedia.
- Agregat kategori setelah memakai snapshot Oktober tersebut adalah Featured News 260.614 views atau 4.738 per post, Teaser 38.386 atau 3.839 per post, Featured Video 132.732 atau 2.885 per post.
- Target 3.000 followers pada 31 Desember membutuhkan 746 tambahan dari saldo akhir Oktober, sekitar 12 per hari selama November dan Desember. Ini target masa depan, bukan hasil Period 1.
- Dua sel 4 November pada `Sheet1!A7:B7` di Sheet grafik khusus laporan telah dikosongkan. Grafik followers menggunakan data Juli sampai Oktober saja.
