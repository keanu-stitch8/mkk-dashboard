# Handoff — MKK Dashboard (per 2026-11-04 malam: metrik IG baru dan acuan laporan period selesai)

Baca ini dulu di chat baru, lalu `README.md`, `AGENTS.md` (Next 16: baca `node_modules/next/dist/docs/` sebelum menulis kode Next), **`docs/architecture/data-flow.md`** (kontrak alur data), `docs/channels-data-flow.md` (baris Social = alur IG audience baru), `docs/team-data-flow.md`, dan memory (`report-deck-style`, `contributor-pay-per-content`, `ig-api-metric-availability`, `mkk-connector-decisions`, `ambiguous-not-true`, `plan-before-report-changes`).

## Status

| Bagian | Status |
| --- | --- |
| Semua commit s/d `e63d68d` (Contributor dirombak) | ✅ di-push |
| **Rencana B — metrik IG baru** (lihat bawah) + 2 migrasi `20261104071718_ig_audience_metrics`, `20261104071912_ig_follower_snapshot_flows` | ✅ selesai & dicek (tsc, eslint, 211 tes, build, halaman); tercakup dalam commit yang memuat handoff ini |
| Cron 4 Nov 15:07: Okt di-sync + **Oktober dikunci** + scorecard Okt di-snapshot | ✅ |
| Scorecard Jul–Sep: Sheets+Drive di-sync ulang (perbaikan tracker pengguna masuk), `snapshotScorecard` Jul–Okt | ✅ (DB saja) |
| Deck laporan 4 bulanan **Period 1 (Jul–Oct 2026)** | ✅ jadi; Step 02 diputuskan "Maintain editorial diversity" dan sudah diterapkan (sesi lanjutan) |
| Deploy server kantor | ⏳ "nanti saja" kata pengguna (`prisma migrate deploy` sekarang 4 migrasi baru) |

**Perubahan kode dalam commit ini (semua sudah diverifikasi):**
- Connector Meta (`src/modules/connectors/sources/meta/{index,map}.ts`): `IgAccountMonth` (profile_views, website_clicks, likes, comments, shares, saves, reposts; views/reach per `follow_type`; bulan terkunci diisi sekali, tak ditimpa), `IgFollowerSnapshot` (followers + follows/unfollows sejak tgl 1, **sekali per hari — snapshot pertama tidak ditimpa**), per post `profileVisits`/`reposts` (Meta menolak `follows` & `profile_visits` untuk **Reels**).
- Halaman Social: section "Audience & discovery" (`social/overview/{lib,services,types}/social-audience*`, `components/social-audience.tsx`) + kolom Follows/Profile visits di Top posts.
- Overview: kartu "Instagram followers" memakai seri followers yang sama (`getIgFollowers`), fallback `ig_account_followersNow`.
- Scorecard: aset "not tracked" bila satu kelompok aset wajib kosong di semua cerita sebulan (`untrackedAssets`, Juli 2026) — tidak lagi 0%.
- Dokumen: `docs/channels-data-flow.md` (baris Social).
- Backfill Jun–Nov sudah dijalankan (DB). Angka: followers 4 Nov **2.274** (terkunci); akhir bulan estimasi Jun 97 · Jul 455 · Agu 1.114 · Sep 1.666 · Okt 2.254.

**Langkah berikutnya (chat baru mulai di sini):**
1. Pengguna sudah menginstruksikan **commit dan push** langsung ke `main` pada akhir sesi ini. Jangan bertanya ulang soal perubahan ini; cek `git status` dan `git log` untuk keadaan terbaru.
2. **Step 02 sudah diputuskan dan diterapkan:** judul "Maintain editorial diversity", deskripsi "Keep sport central, with food, tourism & human interest." (diringkas agar muat di kartu; thumbnail final sudah diperiksa, teks terbaca utuh) Mengikuti maksud draft asli Mba Indah: olahraga sebagai identitas utama, tema lain memperluas pengalaman sports tourism. Keseimbangan tema belum diukur. Usulan Claude lama "Back to July's 45/month" gugur (45 = 21 feed + 19 Reels + 5 video Juli, bukan target client). **Klarifikasi terakhir pengguna mengoreksi pembacaan KPI sebelumnya:** asal KPI 30 Reels + 30 Carousel/bulan dan 60 News/bulan, tetapi Stories JUGA termasuk dalam penghitungan kuota, mengikuti dashboard. Jangan mengubah penghitungan/output-vs-quota menjadi hanya Reels + Carousel. Perubahan isi pada sesi lanjutan: dua kotak teks Step 02; angka dan narasi Output vs Quota dipertahankan. Readback membuktikan 13 slide dan urutannya tetap. Setelah itu pengguna meminta perbaikan layout slide 6 (Output vs Quota): kotak caption diperlebar dan ditinggikan, kalimat October dipisah ke baris kedua, line spacing caption + tiga kartu menjadi 90% (sebelumnya 100%); ukuran font tetap. Preview diperiksa.
3. Opsional: samakan template oranye (warna kartu muda→tua, kotak rounded) supaya Period 2 langsung rapi; hapus deck v1 (warm_orange) ke Trash bila pengguna setuju; tambah kolom **tema** di Socmed log bila tim mau mengukur keseimbangan tema.
4. Sisa lama: deploy server kantor; sisa kecil `docs/architecture/data-flow-audit.md`.
5. Permintaan baru pengguna setelah commit/push diminta: generator laporan empat bulanan perlu ada di submenu **Report / PDF → Period Reports**. Saat ini belum diimplementasikan; deck masih dibuat melalui Composio. Rencana awal memakai template deck yang sudah disetujui, pilihan Period N, hasil Google Slides/PDF, dan aturan batas periode pada `MKK-PERIOD-REPORT-GUIDE.md`. Selesaikan sebagai pekerjaan lanjutan setelah commit ini.

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
