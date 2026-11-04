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
4. Angka per posting bersifat lifetime. Pilih data yang waktu pengukurannya masih berada di dalam period. Jangan otomatis memakai cutoff dashboard tanggal 4 bulan berikutnya. Bila snapshot tanggal terakhir tidak ada, pakai snapshot terakhir yang tersedia sebelum batas dan tampilkan tanggalnya. Jangan menyebutnya hasil tepat akhir bulan.
5. Metrik yang tidak tersedia ditulis `n/a`. Jangan mengambil angka sesudah batas period untuk mengisi kekosongan. Meta tidak menyediakan follows atau profile visits per Reel.
6. Setelah basis metrik posting berubah, hitung ulang semua pemakainya sekaligus, termasuk agregat kategori, views per post, peringkat Top 5, studi kasus, dan evaluasi. Jangan hanya mengganti satu kartu.
7. Kategori Publishing Log bukan tema editorial. Keragaman tema dapat didukung contoh konten, tetapi tidak boleh disebut seimbang tanpa pengukuran tema.
8. Penghitungan kuota mengikuti dashboard. Pengguna menegaskan Stories termasuk. KPI asal client 30 Reels + 30 Carousel dan 60 News per bulan tetap menjadi konteks kontrak, tetapi jangan mengubah agregat deck menjadi hanya Reels + Carousel. Scope deck ini Instagram.
9. Target masa depan diberi konteks sebagai rekomendasi. Selisih menuju target dihitung dari saldo akhir period, bukan saldo terbaru sesudah period.

## Narasi dan visual

- Rayakan pencapaian audiens dan konten yang memiliki bukti, sambil tetap menyampaikan tren realisasi produksi.
- Gunakan bahasa Inggris sederhana dan format angka Indonesia. Hindari titik koma, titik dua, em dash, en dash, dan double hyphen pada teks slide. Nama bulan pada halaman terakhir ditulis lengkap.
- Step 02 membahas keragaman editorial. Judul `Maintain editorial diversity`, deskripsi saat ini `Keep sport central, with food, tourism & human interest.` Jangan mengganti target menjadi realisasi Juli 45 posting.
- Jangan membawa baris kredit Slidesgo yang diminta pengguna dihapus ke laporan berikutnya.
- Pertahankan palet oranye muda ke tua, jenis huruf, radius kartu, dan lebar tabel yang sudah disetujui.
- Caption slide 3, 5, dan 6 memakai kotak lebar yang sama. Pada ukuran internal 3.000.000 EMU, transform kotaknya `scaleX=2.6667`, `scaleY=0.1733`, `translateX=572000`, `translateY=4390000`, dengan jarak antarbaris 90%. Angka ini berlaku pada komposisi dan ukuran slide acuan ini.
- Ringkas teks terlebih dahulu bila tidak muat. Pertahankan ukuran huruf dan periksa hasil native Google Slides.

## Pemeriksaan sebelum selesai

- Cocokkan judul period, bulan pada grafik, empat bulan data, dan tanggal acuan setiap metrik.
- Rekonsiliasi jumlah views, net follows, profile visits, link taps, output, kuota, tabel kategori, dan angka yang berulang antar-slide.
- Periksa bahwa grafik baru terhubung ke Sheet period yang tepat.
- Baca kembali seluruh teks, termasuk grup dan sel tabel. Periksa angka serta tanggal lama yang tertinggal.
- Render seluruh deck dan periksa tampilan native pada bagian yang berubah atau sempit. Pastikan tidak ada teks terpotong, baris tunggal yang menggantung, atau konten bertabrakan.
- Perbarui handoff setelah semua perbaikan selesai. Jangan auto-commit.

## Angka Period 1 setelah koreksi batas period

- Followers akhir Oktober 2.254, estimasi. Saldo pembuka Juli sekitar 97. Net follows selama period +2.157.
- Account views 729.954, profile visits 11.166, bio link taps 231.
- Snapshot posting Oktober terakhir yang tersedia di dalam period adalah 30 Oktober. Tidak ada snapshot 31 Oktober.
- Entok pada 30 Oktober mendapat 16.446 views, reach 11.059, 284 shares, 276 saves, dan 267 likes + comments. Follows pada snapshot tersebut tidak tersedia.
- Agregat kategori setelah memakai snapshot Oktober tersebut adalah Featured News 260.614 views atau 4.738 per post, Teaser 38.386 atau 3.839 per post, Featured Video 132.732 atau 2.885 per post.
- Target 3.000 followers pada 31 Desember membutuhkan 746 tambahan dari saldo akhir Oktober, sekitar 12 per hari selama November dan Desember. Ini target masa depan, bukan hasil Period 1.
- Dua sel 4 November pada `Sheet1!A7:B7` di Sheet grafik khusus laporan telah dikosongkan. Grafik followers menggunakan data Juli sampai Oktober saja.
