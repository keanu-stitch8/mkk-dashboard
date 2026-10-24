# Handoff — MKK Dashboard (per 2026-10-24: login Tahap 0 + refactor data flow selesai, 4 commit belum di-push)

Baca ini dulu di chat baru, lalu `README.md`, `AGENTS.md` (Next 16: baca `node_modules/next/dist/docs/` sebelum menulis kode Next), **`docs/architecture/data-flow.md`** (kontrak alur data, wajib sebelum menyentuh kode data), dan memory (`data-flow-refactor`, `ambiguous-not-true`, `mkk-team-dashboard`, `mkk-connector-decisions`, `all-data-via-api`).

## Status

| Bagian | Status |
| --- | --- |
| Dependency (Next 16.4.2, React 19.3.1, googleapis 187 dipin, vitest 5, cn 0.5, @types/node 24, server-only 0.0.1) | ✅ |
| Import History & Sync History per sesi + pagination | ✅ `7bf668e` |
| Team Tahap 1–4: Stories, Briefs, Content Pipeline, Contributors, Team Scorecard, MKK 2026 in numbers | ✅ `d66ce38` `1bb3f28` `a593d67` (sudah di-push) |
| Tahap 0 login: nama + satu password tim, `src/proxy.ts`, `decidedBy` di TeamMatch | ✅ `599b4f4` — **belum di-push** |
| Refactor data flow ala srikandi: pindah ke `src/`, kontrak + audit, pilot YouTube | ✅ `089fc38` — **belum di-push** |
| YouTube: video non-public tidak dihitung (re-upload) + placeholder thumbnail rusak | ✅ `2d9b120` — **belum di-push** |
| Refactor data flow semua domain (Website, News, Social, Overview, Report, Team, Import, Connectors, Source Logs) | ✅ `36e16df` — **belum di-push** |
| Tahap 0 deploy ke server kantor + subdomain | ⏳ menunggu admin server |

Rencana lengkap Team Dashboard: artifact claude.ai `PdQVdjZM2yew5krRf4Tvmn` (Tahap 0–4; tidak ada Tahap 5).

**Langkah berikutnya (chat baru mulai di sini):**

1. Pengguna wajib **restart `npm run dev`** kalau belum (folder pindah ke `src/`, proxy baru, kolom Prisma `decidedBy`). Dev server lama menjawab 404 untuk semua halaman — pengguna menyebutnya "api error".
2. Tanya pengguna: **push** 4 commit (`main` ahead 4 dari `origin/main`)? Catatan: `36e16df` di-commit setelah pengguna bilang "lanjut semua aja", bukan "commit" — kalau pengguna keberatan, masih bisa diubah (`git reset --soft HEAD~1`).
3. Minta pengguna cek tampilan beberapa halaman di browser (verifikasi refactor hanya lewat teks HTML, belum visual).
4. Tim perlu mengganti link baris **"Gokil Restaurant Kudus"** (20 Okt) di *MKK Internal - Youtube Calendar Timeline* ke `https://youtu.be/M3hjv1RNNLA` (video lama `QFeE5-dl_YY` sudah private karena re-upload), lalu sync connector Sheets — supaya thumbnail Publishing Log muncul.
5. Deploy server kantor (saat admin siap): isi `DASHBOARD_PASSWORD` di `.env` server (produksi tanpa password = dashboard tertutup total), `SESSION_SECRET` opsional (kosong = pakai `ENCRYPTION_KEY`). Reverse proxy wajib meneruskan `Host` dan `X-Forwarded-Proto`. Database SQLite (`prisma/dev.db`) → `prisma migrate deploy` di server. Script di server: `npm run sync` (sudah memakai `tsx --conditions=react-server`).
6. Setelah tim mulai konfirmasi saran / mengisi kolom Story / tab kontributor Oktober: sync connector **Google Drive**.
7. Scorecard Jul–Sep sengaja masih **live** (bulan dikunci 19 Okt, sebelum fitur ada). Setelah tim selesai konfirmasi, unlock + lock bulan itu untuk membekukan angkanya.
8. Opsional, sisa kecil di `docs/architecture/data-flow-audit.md`: kuota di-query 4× per bundle, filter `?show=` Team di komponen, cast di `channelRecommendations`, tes lama di `tests/`.

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
  - `ContributorTask` + `Contributor` ← "MKK Kudus Local Contributor - Task Progress" (`15LY6CsihTxJsHl7Zh2F1qUJ8bqY93TI2Wo8OOoYceOE`); 4 aset Available / Not Available / kosong, alias → nama dari tab Ref. Tab Okt–Des masih kosong.
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

- **Model/kolom Prisma baru atau folder dipindah** → dev server pengguna 500/404 sampai di-restart. Verifikasi sendiri pakai `npm run build && npx next start -p 3100`, lalu matikan.
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
