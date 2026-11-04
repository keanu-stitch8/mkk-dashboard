# Handoff — MKK Dashboard (per 2026-11-04: menu Contributor dirombak, belum di-commit; berikutnya Rencana B metrik IG + deck laporan 4 bulanan)

Baca ini dulu di chat baru, lalu `README.md`, `AGENTS.md` (Next 16: baca `node_modules/next/dist/docs/` sebelum menulis kode Next), **`docs/architecture/data-flow.md`** (kontrak alur data, wajib sebelum menyentuh kode data), `docs/team-data-flow.md`, dan memory (`contributor-pay-per-content`, `ig-api-metric-availability`, `mkk-connector-decisions`, `ambiguous-not-true`, `mkk-team-dashboard`, `all-data-via-api`, `plan-before-report-changes`).

## Status

| Bagian | Status |
| --- | --- |
| Semua commit s/d `0cf5d7e` (login Tahap 0, refactor data flow, tanggal potong tgl 4 15:00 WIB, kontributor KPI 60) | ✅ sudah di-push (`main` = `origin/main`) |
| **Menu Contributor dirombak** (lihat bagian di bawah) — 13 file + 2 migrasi `20261104052521_contributor_extra_role`, `20261104055600_contributor_news_names` | ✅ diverifikasi (tsc, eslint, 202 tes, sync Drive data asli, halaman dicek) — **BELUM di-commit** |
| Rencana B: metrik IG baru untuk laporan 4 bulanan | ⏳ disetujui arah, belum dikerjakan |
| Deck laporan 4 bulanan ("tri semester") | ⏳ menunggu 4 keputusan pengguna |
| Tahap 0 deploy ke server kantor + subdomain | ⏳ menunggu admin server |

**Langkah berikutnya (chat baru mulai di sini):**

1. Tanya pengguna: **commit** kerjaan Contributor? (Pengguna belum bilang "commit".) Usulan pesan: `Kontributor: kredit per konten ala Master Report, Extra Posts, footage YSR, rekap bulanan, Articles → Website dari News log`. Push hanya kalau diminta.
2. **Rencana B — connector Meta** (`src/modules/connectors/sources/meta/index.ts` + `map.ts`), semua gratis & token yang ada sudah cukup (dites 4 Nov):
   - Metrik akun per bulan (period=day, metric_type=total_value, dipotong ≤30 hari seperti `IG_ACCOUNT_ADDITIVE`): `profile_views` (= "Profile visits" di app), `website_clicks` (= "Bio link taps"; **bukan** `profile_links_taps` = tombol kontak, isinya 0), `likes`, `comments`, `shares`, `saves`, `reposts`. Simpan sebagai `Metric` key `ig_account_*`.
   - `views` & `reach` dengan `breakdown=follow_type` → porsi non-follower (reach unik: hanya 30 hari pertama, sama seperti `reach` sekarang). `total_interactions` + follow_type → error Meta, jangan dipakai.
   - **Followers:** API hanya memberi `followers_count` "saat ini" (2.273 per 4 Nov) dan `follower_count` harian = follow BARU, 30 hari terakhir saja. Buat tabel snapshot followers tiap sync/cron. Riwayat Jun–Okt = hitung mundur dari follows−unfollows (net Jun–Okt 2.244, konsisten), tandai estimasi. `followersNow` sekarang **tidak tersimpan** sama sekali (hanya saat bulan berjalan `w.partial`).
   - `IgMediaSnapshot` + `SocialPost`: tambah `follows`, `profileVisits` (`profile_visits`), `reposts`. Catatan: connector sengaja tidak meminta `follows` untuk Reels.
   - Jul–Sep dikunci: backfill sekali jalan **hanya metrik akun baru** (nilai lama jangan disentuh). Metrik per post untuk bulan lama hanya bisa "as of hari ini" → tandai.
   - Template laporan bulanan **jangan** diubah tanpa rencana baris (memory `plan-before-report-changes`).
   - `.env` `META_IG_USER_ID` kosong; ID IG `17841425896162511` diambil dari Page (`instagram_business_account`).
3. **Deck laporan 4 bulanan** (bahan: draft Content & Creative Manager, IG-only, Bahasa Indonesia, periode 15 Jun–29 Okt + Insights ±30 hari). Keputusan yang belum dijawab pengguna: (a) periode — usulan T1 = Jul–Okt; (b) cakupan IG saja atau semua channel; (c) bahasa — laporan klien selama ini EN + format angka ID; (d) format — usulan Google Slides dari template ber-token (Slides API gratis) vs sekali jadi di Canva. Struktur ±12 slide yang sudah diusulkan: cover · exec summary KPI · tren followers per bulan · views/reach + porsi non-follower · per format (`IgAccountByType`, angka pas) · output vs kuota + kategori · top 5 konten (snapshot tanggal potong) · studi kasus Warung Entok (pakai **follows per 1.000 views** ≈13,4 vs rata-rata akun ≈3,3, bukan "9,9% dari total followers") · funnel profil → link → sesi GA4 dari Instagram · evaluasi · rekomendasi + target 3.000 followers akhir Des · metodologi.
   - Catatan angka: net followers API 29 Sep–29 Okt = 525−32 = **+493**, app Insights +452 (beda definisi → catatan kaki). Angka per post terus naik (Entok 15.773 di draft → 19.054 per 4 Nov) → pakai snapshot tanggal potong.
4. Sisa dari handoff lama yang masih berlaku: deploy server kantor (isi `DASHBOARD_PASSWORD`, `prisma migrate deploy`, reverse proxy teruskan `Host` + `X-Forwarded-Proto`); scorecard Jul–Sep masih live (unlock+lock setelah tim konfirmasi); link Gokil Restaurant di Calendar Timeline → `https://youtu.be/M3hjv1RNNLA`; sisa kecil di `docs/architecture/data-flow-audit.md`.

## Menu Contributor (dirombak 4 Nov, belum di-commit)

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
