# Report Generator — laporan bulanan otomatis di Google Sheets

Tanggal: 2026-10-19 · Status: draft untuk review

## Masalah

Setiap bulan ada 4 laporan untuk client — **Website, News, YouTube, Social Media** — yang selama ini dibuat
manual dengan ChatGPT dari export CSV. Semua angkanya sekarang sudah ada di database dashboard (via API).
Tujuan: laporan dibuat otomatis dengan **desain yang sama** (theme, font, halaman, chart) seperti laporan yang
sudah dibuat — dirapikan sekali agar layak laporan corporate — dan setiap bulan tampil konsisten, tanpa biaya.

## Keputusan

| Topik | Keputusan |
|---|---|
| Format hasil | Google Sheets di Drive (bukan .xlsx — library xlsx gratis membuang chart) |
| Cara isi | Salin **master template** per channel lalu ganti penanda `{{…}}` |
| Template | Satu file "TEMPLATE – …" per channel (tetap); laporan lama tidak dipakai sebagai sumber |
| Narasi | Template kalimat + aturan (gratis, deterministik), bahasa Inggris seperti laporan sekarang |
| Pemicu | Tombol per channel di halaman Report + otomatis oleh cron tgl 3 setelah bulan dikunci |
| KPI | Kartu KPI gaya dashboard dibuat sebagai blok sel di sheet Executive Summary |
| Lingkup tahap 1 | Mesin + laporan **Website**. News, YouTube, Social menyusul (masing-masing 1 tahap) |

## Arsitektur

Mesin dipakai bersama; isi tiap laporan khusus per channel.

```
lib/reports/
  engine/            ← sama untuk semua laporan
    tokens.ts        parse & isi penanda di grid sel (murni, tanpa Google)
    sheets.ts        Google Drive/Sheets: copy template, baca grid, kirim batchUpdate
    generate.ts      orkestrasi: copy → baca → rencanakan perubahan → tulis → catat
  channels/
    website.ts       data (dari lib/data/summary) + narasi Website
    news.ts          (tahap berikut)
    youtube.ts       (tahap berikut)
    social.ts        (tahap berikut)
  kpi.ts             definisi kartu KPI per channel (dipakai dashboard & laporan)
```

### Kontrak per channel

```ts
interface ReportChannel {
  id: "website" | "news" | "youtube" | "social";
  title: string;                       // "Website" → nama file "MKK Website Monthly Performance Report – October 2026"
  templateEnv: string;                 // REPORT_TEMPLATE_WEBSITE
  build(month: string): Promise<ReportData>;
}
interface ReportData {
  values: Record<string, string | number | null>;          // {{month_label}}, {{ga4.active_users}}, {{finding.1}}
  tables: Record<string, Record<string, string | number | null>[]>; // {{#channels}} … baris berulang
}
```

`build` hanya membaca fungsi summary yang sudah ada (`getMonthBundle`, `getWebsiteSummary`, …) supaya angka
laporan = angka dashboard. Narasi adalah fungsi murni dari data yang sama.

## Template & penanda

- **Nilai:** sel yang isinya persis `{{key}}` diisi nilai bertipe (angka tetap angka → format sel template
  berlaku, mis. persen/ribuan). Penanda di tengah teks (`Reporting period: {{period}}`) diisi string.
- **Tabel berulang:** satu baris contoh dengan penanda `{{#nama_tabel.kolom}}`. Mesin menyisipkan baris sebanyak
  data (mewarisi format baris contoh) lalu mengisinya. Data kosong → baris contoh berisi "—".
- **Baris total / teks statis** (mis. "City attribution is approximate in GA4.") tetap di template, bukan kode.
- Penanda yang tidak dikenal dibiarkan apa adanya dan dilaporkan sebagai peringatan (tidak menggagalkan).
- Template dibuat **sekali** dari laporan September: salinan, angka diganti penanda, baris tabel diringkas
  menjadi satu baris contoh. Setelah itu template bebas diedit user selama penanda tetap ada.
- **Rapikan untuk laporan corporate** (disetujui user): identitas laporan tetap (palet warna, font, urutan & nama
  halaman, chart), tapi tiap halaman boleh dirapikan — konsistensi judul/subjudul, spasi antar blok, perataan
  angka kanan, format angka seragam (ribuan, %, 2 desimal untuk rasio), lebar kolom, freeze header tabel,
  gridlines disembunyikan, area cetak/ukuran halaman A4 landscape. Template hasil rapihan **direview user dulu**
  sebelum dipakai generate.

## Kartu KPI (Executive Summary)

Blok sel per kartu (4 kartu per baris), mengikuti warna & font laporan:

```
┌──────────────────────┐
│ Views                │  label
│ 732                  │  nilai (font besar, format angka)
│ ↓ −70,2% vs last month│  perubahan — hijau/merah via conditional formatting (teks diawali ↑ / ↓)
│ +5 / −0              │  catatan opsional
└──────────────────────┘
```

- Daftar KPI per channel = grid KPI di halaman dashboard channel itu; definisinya dipindah ke `lib/reports/kpi.ts`
  dan dipakai **dashboard dan laporan** (satu sumber).
- Perubahan memakai aturan dashboard: `%` untuk jumlah, `pp` untuk rasio; "turun = bagus" untuk metrik seperti
  bounce rate / posisi (penanda arah dari mesin: `{{kpi.x.tone}}` = good/bad/flat untuk conditional formatting).
- Tanpa data bulan lalu → "No data last month".
- Menggantikan baris KPI polos yang ada di Executive Summary sekarang.

## Narasi (template kalimat)

Fungsi per channel menghasilkan kalimat bernomor (`{{finding.1}}`…`{{finding.n}}`, `{{watchout.1}}`…),
mis. Website:
- "Direct generated 905 sessions (49.2% of 1,839) with a 45.1% engagement rate."
- Watchout: kota di luar Indonesia di top cities, CTR GSC turun > 2 pp MoM, channel naik/turun > 50% MoM,
  landing "(not set)" > 5% sesi.
Slot narasi yang tidak terpakai bulan itu dikosongkan. Hasil tetap bisa diedit manual di Sheets.

## Alur generate

1. Cek: template channel dikonfigurasi, akun Google punya scope `drive.file`, data bulan ada.
2. Copy template → nama "MKK {Channel} Monthly Performance Report – {Month YYYY}" di folder output
   (`REPORT_FOLDER_ID`, default: folder template).
3. Baca semua sheet (nilai sel) → `tokens.ts` merencanakan: penyisipan baris tabel + nilai per sel.
4. Kirim ke Sheets API (`batchUpdate` insertDimension untuk baris tabel, lalu `values.batchUpdate`).
5. Catat di tabel `GeneratedReport` (channel, month, fileId, url, trigger, createdAt, warnings).
6. Jika laporan bulan+channel sudah ada: file lama di-rename dengan akhiran "(lama YYYY-MM-DD)", tidak dihapus.

Pemicu:
- **Tombol** "Buat laporan Google Sheets" per channel di halaman `/report` + daftar link laporan yang sudah dibuat.
  Bulan belum dikunci → peringatan "angka masih bisa berubah" (tetap boleh).
- **Cron** tgl 3: setelah bulan lalu berhasil di-sync & dikunci, generate semua channel yang template-nya ada.

## Izin Google

Scope connector Google ditambah `https://www.googleapis.com/auth/drive.file` (buat & edit file milik app;
template dibaca lewat `drive.readonly` yang sudah ada). User menghubungkan ulang akun Google sekali di
Pengaturan → Connectors. Tanpa scope → pesan jelas + link ke halaman Connectors.

Konfigurasi `.env.local`: `REPORT_TEMPLATE_WEBSITE`, `REPORT_TEMPLATE_NEWS`, `REPORT_TEMPLATE_YOUTUBE`,
`REPORT_TEMPLATE_SOCIAL`, `REPORT_FOLDER_ID` (opsional).

## Error handling

- Template tidak ada / tidak bisa dibaca → gagal dengan pesan, tidak membuat file.
- Gagal di tengah pengisian → file salinan di-rename "(GAGAL …)" supaya tidak tertukar dengan laporan jadi;
  error dicatat di `GeneratedReport`.
- Penanda tak dikenal / tabel kosong → peringatan, bukan error.

## Tes

- `tokens.ts`: unit test dengan grid palsu (nilai, teks campuran, tabel berulang, tabel kosong, penanda asing).
- `channels/website.ts`: data & narasi dari bundle contoh (angka September) → kalimat & watchout yang diharapkan.
- `kpi.ts`: arah warna & format perubahan (%, pp, turun = bagus).
- End-to-end manual: generate Website September dari template → bandingkan dengan laporan September buatan user.

## Risiko yang diuji paling awal

- **Chart ikut meluas** saat baris tabel disisipkan. Jika tidak, mesin memperbarui rentang chart
  (`updateChartSpec`) sesuai jumlah baris.
- **Conditional formatting** kartu KPI ikut tersalin & berlaku pada sel hasil isi.

## Di luar lingkup

- Laporan News, YouTube, Social (tahap berikut, mesin sama).
- Narasi AI, export .xlsx/PDF otomatis (Sheets sudah bisa File → Download), kirim email ke client.
