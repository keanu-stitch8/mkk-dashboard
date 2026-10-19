# Report Generator — Tahap 1 (mesin + laporan Website) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tombol (dan cron) yang membuat laporan bulanan Website sebagai file Google Sheets baru dari master template, berisi angka dashboard, kartu KPI, tabel, dan narasi otomatis.

**Architecture:** Mesin murni (`planFill`) membaca grid template berisi penanda `{{…}}` dan data laporan, lalu menghasilkan rencana (sisip baris, merge, tulis nilai, warna KPI). Lapisan Google (`sheets.ts`) hanya menyalin file, membaca grid, dan menjalankan rencana. Data & narasi per channel ada di `lib/reports/channels/*`; tahap 1 hanya Website. File user tidak pernah diubah — semua tulis ke file buatan app (`drive.file`).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma 6 + SQLite, `googleapis` 181 (Drive v3, Sheets v4), Vitest.

Spec: `docs/superpowers/specs/2026-10-19-report-generator-design.md`

---

## Prasyarat (dikerjakan user, sekali)

1. Aktifkan **Google Sheets API** di project Google Cloud OAuth client (project `330844859310`):
   https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=330844859310
2. Setelah Task 1 selesai: Pengaturan → Connectors → kartu **Google Sheets** → "Ganti akun"/hubungkan ulang,
   centang semua izin (sekarang termasuk "lihat, edit, buat file Drive yang dipakai app ini").

## Struktur file

| File | Tanggung jawab |
|---|---|
| `lib/reports/types.ts` | Tipe bersama: `Cell`, `Tone`, `ReportData`, `ReportChannel` |
| `lib/reports/engine/tokens.ts` | **Murni.** `planFill(grids, data)` → `Plan` (sisip baris, merge, tulis, tone) |
| `lib/reports/engine/sheets.ts` | Google: auth+cek scope, copy file, baca grid, jalankan plan, rename |
| `lib/reports/engine/generate.ts` | Orkestrasi + catat `GeneratedReport`; rename laporan lama/gagal |
| `lib/reports/kpi.ts` | Definisi kartu KPI + format perubahan (EN) + tone; dipakai dashboard & laporan |
| `lib/reports/channels/website.ts` | `build(month)` Website: values, tables, narasi |
| `lib/reports/channels/website-narrative.ts` | **Murni.** kalimat temuan/watchout/readout Website |
| `lib/reports/channels/index.ts` | Registry channel laporan (tahap 1: website) |
| `lib/reports/id-cities.ts` | Daftar kota Indonesia (heuristik lokasi tak biasa) |
| `scripts/report-template-website.ts` | Sekali jalan: salin laporan September user → TEMPLATE baru (rapikan + penanda + kartu KPI) |
| `app/api/reports/generate/route.ts` | POST generate |
| `components/report/ReportGenerator.tsx` | Tombol + daftar laporan di halaman /report |
| `prisma/schema.prisma` | Model `GeneratedReport` |
| `tests/reports-tokens.test.ts`, `tests/reports-kpi.test.ts`, `tests/reports-website.test.ts` | Tes |

---

### Task 1: Scope `drive.file` + cek scope

**Files:**
- Modify: `lib/connectors/google-oauth.ts:13-19` (GOOGLE_SCOPES.sheets) dan tambah `grantedScopes`
- Test: `tests/reports-tokens.test.ts` (dibuat di Task 3; Task ini tanpa tes unit — perilaku OAuth diuji manual)

- [ ] **Step 1: Tambah scope & helper**

Di `lib/connectors/google-oauth.ts` ganti entri `sheets`:

```ts
  // drive.readonly: cari file by nama + export ke XLSX (Publishing Log).
  // drive.file: buat & edit file milik app ini (laporan hasil generate) — tidak bisa menyentuh file user lain.
  sheets: ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/drive.file"],
```

Tambahkan di bawah `oauthAccount`:

```ts
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Scope yang benar-benar diberikan user saat menghubungkan akun (kosong jika belum terhubung). */
export async function grantedScopes(connector: GoogleOAuthConnector): Promise<string[]> {
  const row = await prisma.connectorCredential.findUnique({ where: { connector } });
  if (!row) return [];
  return ((JSON.parse(decrypt(row.data)) as StoredToken).scope ?? "").split(/\s+/).filter(Boolean);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: tanpa output.

- [ ] **Step 3: Commit**

```bash
git add lib/connectors/google-oauth.ts
git commit -m "Google Sheets connector: scope drive.file untuk laporan + grantedScopes"
```

---

### Task 2: Model `GeneratedReport`

**Files:**
- Modify: `prisma/schema.prisma` (tambah di akhir)

- [ ] **Step 1: Tambah model**

```prisma
/// Laporan bulanan yang dibuat dashboard (file Google Sheets baru dari master template).
model GeneratedReport {
  id        String   @id @default(cuid())
  channel   String // website | news | youtube | social
  month     String // YYYY-MM
  fileId    String?
  url       String?
  status    String // success | error
  trigger   String // manual | cron
  warnings  String?
  error     String?
  createdAt DateTime @default(now())

  @@index([channel, month])
}
```

- [ ] **Step 2: Migrasi**

Run: `npx prisma migrate dev --name generated_report`
Expected: `Applying migration ..._generated_report`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Model GeneratedReport"
```

---

### Task 3: Tipe + mesin `planFill` (murni)

**Files:**
- Create: `lib/reports/types.ts`
- Create: `lib/reports/engine/tokens.ts`
- Test: `tests/reports-tokens.test.ts`

Aturan penanda:
- Sel persis `{{key}}` → nilai bertipe dari `data.values[key]` (angka tetap angka). `null` → `""`.
- Penanda di dalam teks → diganti string (angka diformat `en-US`).
- Baris dengan penanda `{{#tabel.kolom}}` = baris contoh tabel. N baris data → sisip N−1 baris tepat di bawahnya
  (mewarisi format), merge baris contoh diulang, sel tanpa penanda di baris contoh disalin apa adanya.
  N = 0 → sel penanda pertama "—", sisanya "".
- Kunci/tabel tak dikenal → teks dibiarkan, masuk `warnings`.
- `data.tones[key]` → tulisan diberi warna tone (kartu KPI).

- [ ] **Step 1: Tulis tipe**

`lib/reports/types.ts`:

```ts
export type Cell = string | number | null;
/** Warna perubahan KPI: good = hijau, bad = merah, flat/none = abu. */
export type Tone = "good" | "bad" | "flat" | "none";
export type ReportChannelId = "website" | "news" | "youtube" | "social";

export interface ReportData {
  /** {{key}} → nilai */
  values: Record<string, Cell>;
  /** {{#tabel.kolom}} → baris berulang */
  tables: Record<string, Record<string, Cell>[]>;
  /** key nilai yang selnya diwarnai (mis. kpi.views.change) */
  tones?: Record<string, Tone>;
}

export interface ReportChannel {
  id: ReportChannelId;
  /** dipakai di nama file: "MKK {title} Monthly Performance Report – {Month YYYY}" */
  title: string;
  /** nama env berisi ID file master template */
  templateEnv: string;
  build(month: string): Promise<ReportData>;
}
```

- [ ] **Step 2: Tulis tes yang gagal**

`tests/reports-tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planFill, type SheetGrid } from "../lib/reports/engine/tokens";

const grid = (rows: string[][], merges: SheetGrid["merges"] = []): SheetGrid => ({ sheetId: 7, title: "01 Summary", rows, merges });

describe("planFill", () => {
  it("mengisi nilai bertipe & teks campuran", () => {
    const plan = planFill([grid([["{{users}}", "Period: {{period}} · {{users}} users"]])], { values: { users: 1839, period: "1–30 September 2026" }, tables: {} });
    expect(plan.writes).toEqual([
      { sheetTitle: "01 Summary", row: 0, col: 0, value: 1839 },
      { sheetTitle: "01 Summary", row: 0, col: 1, value: "Period: 1–30 September 2026 · 1,839 users" },
    ]);
    expect(plan.inserts).toEqual([]);
  });

  it("menggandakan baris tabel, menggeser baris di bawahnya, mengulang merge", () => {
    const plan = planFill(
      [grid([["Channel", "Sessions"], ["{{#ch.name}}", "{{#ch.sessions}}"], ["Total", "{{total}}"]], [{ startRow: 1, endRow: 2, startCol: 0, endCol: 1 }])],
      { values: { total: 30 }, tables: { ch: [{ name: "Direct", sessions: 20 }, { name: "Search", sessions: 7 }, { name: "Social", sessions: 3 }] } },
    );
    expect(plan.inserts).toEqual([{ sheetId: 7, at: 2, count: 2 }]);
    expect(plan.merges).toEqual([
      { sheetId: 7, startRow: 2, endRow: 3, startCol: 0, endCol: 1 },
      { sheetId: 7, startRow: 3, endRow: 4, startCol: 0, endCol: 1 },
    ]);
    expect(plan.writes).toEqual([
      { sheetTitle: "01 Summary", row: 1, col: 0, value: "Direct" },
      { sheetTitle: "01 Summary", row: 1, col: 1, value: 20 },
      { sheetTitle: "01 Summary", row: 2, col: 0, value: "Search" },
      { sheetTitle: "01 Summary", row: 2, col: 1, value: 7 },
      { sheetTitle: "01 Summary", row: 3, col: 0, value: "Social" },
      { sheetTitle: "01 Summary", row: 3, col: 1, value: 3 },
      { sheetTitle: "01 Summary", row: 4, col: 1, value: 30 },
    ]);
  });

  it("tabel kosong → '—' di sel penanda pertama", () => {
    const plan = planFill([grid([["{{#q.text}}", "{{#q.clicks}}"]])], { values: {}, tables: { q: [] } });
    expect(plan.writes).toEqual([
      { sheetTitle: "01 Summary", row: 0, col: 0, value: "—" },
      { sheetTitle: "01 Summary", row: 0, col: 1, value: "" },
    ]);
  });

  it("penanda tak dikenal dibiarkan + peringatan; tone ikut di write", () => {
    const plan = planFill([grid([["{{nope}}", "{{kpi.views.change}}"]])], { values: { "kpi.views.change": "↑ +2.6% vs last month" }, tables: {}, tones: { "kpi.views.change": "good" } });
    expect(plan.writes).toEqual([{ sheetTitle: "01 Summary", row: 0, col: 1, value: "↑ +2.6% vs last month", tone: "good" }]);
    expect(plan.warnings).toEqual(['01 Summary!A1: penanda "nope" tidak dikenal']);
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `npx vitest run tests/reports-tokens.test.ts`
Expected: FAIL — `Cannot find module '../lib/reports/engine/tokens'`

- [ ] **Step 4: Implementasi**

`lib/reports/engine/tokens.ts`:

```ts
// Mesin template laporan (murni, tanpa Google): grid sel berpenanda {{…}} + data → rencana perubahan.
import type { Cell, ReportData, Tone } from "../types";

export interface Merge {
  startRow: number; // 0-based, end eksklusif
  endRow: number;
  startCol: number;
  endCol: number;
}
export interface SheetGrid {
  sheetId: number;
  title: string;
  rows: string[][];
  merges: Merge[];
}
export interface Write {
  sheetTitle: string;
  row: number;
  col: number;
  value: Cell;
  tone?: Tone;
}
export interface Plan {
  /** sisip `count` baris pada indeks `at` (sudah memperhitungkan sisipan sebelumnya; jalankan berurutan) */
  inserts: { sheetId: number; at: number; count: number }[];
  merges: (Merge & { sheetId: number })[];
  writes: Write[];
  warnings: string[];
}

const TOKEN = /\{\{\s*(#?[\w.-]+)\s*\}\}/g;
const EXACT = /^\{\{\s*(#?[\w.-]+)\s*\}\}$/;
const a1 = (row: number, col: number) => `${String.fromCharCode(65 + col)}${row + 1}`;
const fmt = (v: Cell) => (v == null ? "" : typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v);

export function planFill(grids: SheetGrid[], data: ReportData): Plan {
  const plan: Plan = { inserts: [], merges: [], writes: [], warnings: [] };
  for (const g of grids) {
    let offset = 0;
    g.rows.forEach((cells, r) => {
      const row = r + offset;
      const tableNames = new Set<string>();
      for (const c of cells) for (const m of (c ?? "").matchAll(TOKEN)) if (m[1].startsWith("#")) tableNames.add(m[1].slice(1).split(".")[0]);

      // resolusi satu sel; `rec` = baris tabel (null untuk sel biasa)
      const resolve = (text: string, col: number, rec: Record<string, Cell> | null, outRow: number): Write | null => {
        const exact = text.match(EXACT);
        const lookup = (key: string): { ok: boolean; value: Cell } => {
          if (key.startsWith("#")) {
            const col2 = key.slice(1).split(".").slice(1).join(".");
            return rec && col2 in rec ? { ok: true, value: rec[col2] } : { ok: false, value: null };
          }
          return key in data.values ? { ok: true, value: data.values[key] } : { ok: false, value: null };
        };
        if (exact) {
          const { ok, value } = lookup(exact[1]);
          if (!ok) {
            if (!exact[1].startsWith("#")) plan.warnings.push(`${g.title}!${a1(r, col)}: penanda "${exact[1]}" tidak dikenal`);
            return null;
          }
          const tone = data.tones?.[exact[1]];
          return { sheetTitle: g.title, row: outRow, col, value: value ?? "", ...(tone ? { tone } : {}) };
        }
        let changed = false;
        const out = text.replace(TOKEN, (whole, key: string) => {
          const { ok, value } = lookup(key);
          if (!ok) {
            plan.warnings.push(`${g.title}!${a1(r, col)}: penanda "${key}" tidak dikenal`);
            return whole;
          }
          changed = true;
          return fmt(value);
        });
        return changed ? { sheetTitle: g.title, row: outRow, col, value: out } : null;
      };

      if (!tableNames.size) {
        cells.forEach((text, col) => {
          if (!text || !TOKEN.test(text)) return;
          TOKEN.lastIndex = 0;
          const w = resolve(text, col, null, row);
          if (w) plan.writes.push(w);
        });
        TOKEN.lastIndex = 0;
        return;
      }

      const name = [...tableNames][0];
      if (tableNames.size > 1) plan.warnings.push(`${g.title}!${a1(r, 0)}: lebih dari satu tabel di satu baris (${[...tableNames].join(", ")}) — hanya "${name}" dipakai`);
      const records = data.tables[name];
      if (!records) {
        plan.warnings.push(`${g.title}!${a1(r, 0)}: tabel "${name}" tidak dikenal`);
        return;
      }
      if (!records.length) {
        let first = true;
        cells.forEach((text, col) => {
          if (!text || !text.includes("{{#")) return;
          plan.writes.push({ sheetTitle: g.title, row, col, value: first ? "—" : "" });
          first = false;
        });
        return;
      }
      if (records.length > 1) {
        plan.inserts.push({ sheetId: g.sheetId, at: row + 1, count: records.length - 1 });
        const rowMerges = g.merges.filter((m) => m.startRow === r && m.endRow === r + 1);
        for (let i = 1; i < records.length; i++) for (const m of rowMerges) plan.merges.push({ sheetId: g.sheetId, startRow: row + i, endRow: row + i + 1, startCol: m.startCol, endCol: m.endCol });
      }
      records.forEach((rec, i) => {
        cells.forEach((text, col) => {
          if (!text) return;
          if (!TOKEN.test(text)) {
            TOKEN.lastIndex = 0;
            if (i > 0) plan.writes.push({ sheetTitle: g.title, row: row + i, col, value: text });
            return;
          }
          TOKEN.lastIndex = 0;
          const w = resolve(text, col, rec, row + i);
          if (w) plan.writes.push(w);
        });
      });
      offset += records.length - 1;
    });
  }
  return plan;
}
```

- [ ] **Step 5: Jalankan tes, pastikan lolos**

Run: `npx vitest run tests/reports-tokens.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/reports/types.ts lib/reports/engine/tokens.ts tests/reports-tokens.test.ts
git commit -m "Report engine: planFill (penanda, tabel berulang, merge, tone)"
```

---

### Task 4: Kartu KPI (`kpi.ts`) — satu sumber untuk dashboard & laporan

**Files:**
- Create: `lib/reports/kpi.ts`
- Modify: `app/website/page.tsx:42-53` (pakai `WEBSITE_KPIS`)
- Test: `tests/reports-kpi.test.ts`

- [ ] **Step 1: Tulis tes yang gagal**

`tests/reports-kpi.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { kpiData, type KpiDef } from "../lib/reports/kpi";

type S = { views: number | null; er: number | null; pos: number | null; time: number | null };
const defs: KpiDef<S>[] = [
  { key: "views", label: "Views", kind: "count", get: (s) => s.views },
  { key: "er", label: "Engagement rate", kind: "rate", get: (s) => s.er },
  { key: "pos", label: "Avg position", kind: "decimal", goodWhenUp: false, get: (s) => s.pos },
  { key: "time", label: "Avg engagement time", kind: "duration", get: (s) => s.time },
];

describe("kpiData", () => {
  it("nilai, perubahan EN (% / pp), tone termasuk 'turun = bagus'", () => {
    const d = kpiData(defs, { views: 732, er: 0.0444, pos: 8.6, time: 104 }, { views: 2456, er: 0.0534, pos: 9.6, time: 127 });
    expect(d.values["kpi.views.label"]).toBe("Views");
    expect(d.values["kpi.views.value"]).toBe(732);
    expect(d.values["kpi.views.change"]).toBe("↓ −70.2% vs last month");
    expect(d.tones["kpi.views.change"]).toBe("bad");
    expect(d.values["kpi.er.change"]).toBe("↓ −0.9 pp vs last month");
    expect(d.values["kpi.pos.change"]).toBe("↓ −10.4% vs last month");
    expect(d.tones["kpi.pos.change"]).toBe("good");
    expect(d.values["kpi.time.value"]).toBe("1m 44s");
  });

  it("tanpa bulan lalu", () => {
    const d = kpiData(defs, { views: 10, er: null, pos: null, time: null }, null);
    expect(d.values["kpi.views.change"]).toBe("No data last month");
    expect(d.tones["kpi.views.change"]).toBe("none");
    expect(d.values["kpi.er.value"]).toBe(null);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/reports-kpi.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implementasi**

`lib/reports/kpi.ts`:

```ts
// Definisi kartu KPI per channel — dipakai grid KPI dashboard dan blok kartu KPI di laporan Google Sheets.
import type { Cell, Tone } from "./types";

export type KpiKind = "count" | "rate" | "decimal" | "duration";

export interface KpiDef<S> {
  key: string;
  label: string;
  kind: KpiKind;
  /** false: turun = bagus (bounce rate, posisi) */
  goodWhenUp?: boolean;
  get: (s: S) => number | null | undefined;
  /** keterangan dashboard (tooltip) */
  hint?: string;
}

const MINUS = "−";
const en1 = (v: number) => Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Durasi detik → "1m 44s" / "45s" (laporan EN). */
export function fmtDurationEn(sec: number): string {
  const s = Math.round(sec);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

/** Perubahan vs bulan lalu dalam bahasa Inggris + tone warna. */
export function kpiChange(kind: KpiKind, cur: number | null | undefined, prev: number | null | undefined, goodWhenUp = true): { text: string; tone: Tone } {
  if (cur == null || prev == null || (kind !== "rate" && prev === 0)) return { text: "No data last month", tone: "none" };
  const diff = cur - prev;
  const flat = kind === "rate" ? Math.abs(diff) < 0.0005 : Math.abs(diff / prev) < 0.0005;
  const arrow = flat ? "→" : diff > 0 ? "↑" : "↓";
  const sign = flat ? "" : diff > 0 ? "+" : MINUS;
  const body = kind === "rate" ? `${sign}${en1(diff * 100)} pp` : `${sign}${en1((diff / prev) * 100)}%`;
  const tone: Tone = flat ? "flat" : diff > 0 === goodWhenUp ? "good" : "bad";
  return { text: `${arrow} ${flat ? (kind === "rate" ? "0.0 pp" : "0.0%") : body} vs last month`, tone };
}

/** Nilai kartu KPI untuk laporan: kpi.<key>.label / .value / .change (+ tone). */
export function kpiData<S>(defs: KpiDef<S>[], cur: S, prev: S | null): { values: Record<string, Cell>; tones: Record<string, Tone> } {
  const values: Record<string, Cell> = {};
  const tones: Record<string, Tone> = {};
  for (const d of defs) {
    const v = d.get(cur) ?? null;
    values[`kpi.${d.key}.label`] = d.label;
    values[`kpi.${d.key}.value`] = v == null ? null : d.kind === "duration" ? fmtDurationEn(v) : v;
    const ch = kpiChange(d.kind, v, prev ? d.get(prev) : null, d.goodWhenUp ?? true);
    values[`kpi.${d.key}.change`] = ch.text;
    tones[`kpi.${d.key}.change`] = ch.tone;
  }
  return { values, tones };
}

/** Kartu KPI Website (urutan = grid dashboard & blok kartu laporan). */
export interface WebsiteKpiSource {
  users: number | null;
  newUsers: number | null;
  sessions: number | null;
  pageviews: number | null;
  engagementRate: number | null;
  bounceRate: number | null;
  avgEngagementTime: number | null;
  gscClicks: number | null;
  gscImpressions: number | null;
  gscCtr: number | null;
  gscPosition: number | null;
  engagedSessions: number | null;
}
export const WEBSITE_KPIS: KpiDef<WebsiteKpiSource>[] = [
  { key: "users", label: "Users", kind: "count", get: (s) => s.users },
  { key: "new_users", label: "New users", kind: "count", get: (s) => s.newUsers },
  { key: "sessions", label: "Sessions", kind: "count", get: (s) => s.sessions, hint: "Jumlah sesi semua channel (Traffic acquisition)." },
  { key: "views", label: "Views", kind: "count", get: (s) => s.pageviews },
  { key: "engagement_rate", label: "Engagement rate", kind: "rate", get: (s) => s.engagementRate, hint: "Engaged sessions ÷ sessions." },
  { key: "bounce_rate", label: "Bounce rate", kind: "rate", goodWhenUp: false, get: (s) => s.bounceRate, hint: "1 − engagement rate (definisi GA4)." },
  { key: "avg_engagement_time", label: "Avg engagement time", kind: "duration", get: (s) => s.avgEngagementTime, hint: "Rata-rata waktu engagement per sesi." },
  { key: "gsc_clicks", label: "GSC clicks", kind: "count", get: (s) => s.gscClicks },
  { key: "gsc_impressions", label: "GSC impressions", kind: "count", get: (s) => s.gscImpressions },
  { key: "gsc_ctr", label: "GSC CTR", kind: "rate", get: (s) => s.gscCtr },
  { key: "gsc_position", label: "Avg position", kind: "decimal", goodWhenUp: false, get: (s) => s.gscPosition, hint: "Rata-rata posisi tertimbang impressions. Makin kecil makin baik." },
  { key: "engaged_sessions", label: "Engaged sessions", kind: "count", get: (s) => s.engagedSessions },
];
```

- [ ] **Step 4: Jalankan tes, pastikan lolos**

Run: `npx vitest run tests/reports-kpi.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Dashboard Website memakai definisi yang sama**

Di `app/website/page.tsx`, ganti 12 baris `<KpiCard …/>` (baris 42–53) dengan:

```tsx
        {WEBSITE_KPIS.map((k) => {
          const cur = k.get(w);
          const value = k.kind === "rate" ? fmtPct(cur) : k.kind === "duration" ? fmtDuration(cur) : k.kind === "decimal" ? fmtNum(cur, 1) : fmtNum(cur);
          return (
            <KpiCard
              key={k.key}
              label={k.label}
              value={value}
              cur={cur}
              prev={p ? k.get(p) : null}
              kind={k.kind === "rate" ? "rate" : undefined}
              goodWhenUp={k.goodWhenUp}
              hint={k.hint}
              note={k.key === "users" && w.usersEstimated ? "Estimasi dari jumlah per kota" : undefined}
            />
          );
        })}
```

dan tambahkan import `import { WEBSITE_KPIS } from "@/lib/reports/kpi";`. Pastikan `p` di halaman bertipe summary Website bulan lalu (sudah ada: `p?.users` dipakai sebelumnya); jika `p` bisa `undefined`, `p ? k.get(p) : null` sudah menanganinya. Jika `KpiCard` tidak menerima `goodWhenUp={undefined}`, lewati prop dengan `{...(k.goodWhenUp === false ? { goodWhenUp: false } : {})}`.

- [ ] **Step 6: Typecheck + lint + cek halaman**

Run: `npx tsc --noEmit -p . && npx eslint app/website/page.tsx lib/reports/kpi.ts`
Expected: tanpa output. Buka `http://localhost:3000/website?m=2026-09` — 12 kartu sama seperti sebelumnya.

- [ ] **Step 7: Commit**

```bash
git add lib/reports/kpi.ts tests/reports-kpi.test.ts app/website/page.tsx
git commit -m "KPI Website: definisi bersama dashboard & laporan (perubahan EN + tone)"
```

---

### Task 5: Narasi Website (murni)

**Files:**
- Create: `lib/reports/id-cities.ts`
- Create: `lib/reports/channels/website-narrative.ts`
- Test: `tests/reports-website.test.ts`

- [ ] **Step 1: Daftar kota Indonesia**

`lib/reports/id-cities.ts`:

```ts
// Heuristik "lokasi tak biasa": kota GA4 yang tidak ada di daftar ini ditandai untuk divalidasi.
// GA4 connector hanya menyimpan nama kota (tanpa negara); tambahkan kota Indonesia bila muncul false positive.
export const ID_CITIES = new Set(
  [
    "Kudus", "Jepara", "Pati", "Demak", "Rembang", "Blora", "Grobogan", "Purwodadi", "Semarang", "Salatiga", "Kendal", "Ungaran",
    "Surakarta", "Solo", "Klaten", "Boyolali", "Sukoharjo", "Karanganyar", "Sragen", "Wonogiri", "Magelang", "Temanggung", "Wonosobo",
    "Purworejo", "Kebumen", "Banjarnegara", "Purbalingga", "Purwokerto", "Banyumas", "Cilacap", "Tegal", "Brebes", "Pemalang",
    "Pekalongan", "Batang", "Yogyakarta", "Sleman", "Bantul", "Jakarta", "Bogor", "Depok", "Tangerang", "Bekasi", "Bandung",
    "Cimahi", "Cirebon", "Tasikmalaya", "Sukabumi", "Karawang", "Serang", "Cilegon", "Surabaya", "Malang", "Sidoarjo", "Gresik",
    "Kediri", "Madiun", "Jember", "Banyuwangi", "Tuban", "Bojonegoro", "Lamongan", "Mojokerto", "Pasuruan", "Probolinggo",
    "Blitar", "Tulungagung", "Denpasar", "Mataram", "Kupang", "Medan", "Pekanbaru", "Padang", "Palembang", "Jambi", "Bengkulu",
    "Bandar Lampung", "Batam", "Pontianak", "Banjarmasin", "Balikpapan", "Samarinda", "Palangkaraya", "Makassar", "Manado",
    "Palu", "Kendari", "Gorontalo", "Ambon", "Jayapura", "Sorong", "Banda Aceh",
  ].map((c) => c.toLowerCase()),
);

export const isIndonesianCity = (city: string) => ID_CITIES.has(city.trim().toLowerCase());
```

- [ ] **Step 2: Tulis tes yang gagal**

`tests/reports-website.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cityNotes, websiteFindings, type WebsiteNarrativeInput } from "../lib/reports/channels/website-narrative";

const sep: WebsiteNarrativeInput = {
  monthLabel: "September 2026",
  prevMonthLabel: "August 2026",
  users: 835,
  pageviews: 7203,
  pagePaths: 431,
  sessions: 1839,
  prevSessions: 1500,
  channels: [
    { label: "Direct", sessions: 905, share: 0.492, prevSessions: 400 },
    { label: "Organic Search", sessions: 632, share: 0.344, prevSessions: 600 },
  ],
  cities: [
    { city: "Kudus", users: 301 },
    { city: "Semarang", users: 168 },
    { city: "Tel Aviv-Yafo", users: 23 },
  ],
  notSetSessions: 147,
  gsc: { clicks: 98, impressions: 546, ctr: 0.1795, position: 8.62, prevCtr: 0.21 },
};

describe("website narrative", () => {
  it("temuan utama + watchout", () => {
    expect(websiteFindings(sep)).toEqual([
      "Direct generated 905 sessions (49.2%), followed by Organic Search at 632 (34.4%).",
      "The website recorded 7,203 page views across 431 page paths and 835 active users (8.63 views per user).",
      "Kudus is the largest city audience with 301 active users (36.0% of site-wide active users).",
      "Sessions rose 22.6% vs August 2026 (1,500 → 1,839).",
      "Direct sessions rose 126.3% MoM (400 → 905).",
      "The landing-page dimension was “(not set)” for 147 sessions (8.0%); review landing-page tagging.",
      "Google Search Console recorded 98 clicks and 546 impressions (17.95% CTR) at an average position of 8.6.",
      "Search CTR fell 3.1 pp vs August 2026; review titles and meta descriptions of top-impression pages.",
      "City attribution is approximate. Treat Tel Aviv-Yafo as a location to validate before interpretation.",
    ]);
  });

  it("catatan kota", () => {
    const notes = cityNotes(sep.cities, sep.users);
    expect(notes[0]).toEqual({ readout: "Largest city audience; 36.0% of site-wide active users.", note: "City attribution is approximate in GA4." });
    expect(notes[1].readout).toBe("Second-largest city audience.");
    expect(notes[2]).toEqual({ readout: "Unusual location for the target audience; validate before interpretation.", note: "Not in the Indonesian city reference list; validate before interpreting." });
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `npx vitest run tests/reports-website.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implementasi**

`lib/reports/channels/website-narrative.ts`:

```ts
// Narasi laporan Website (bahasa Inggris, template kalimat + aturan). Murni — mudah dites.
import { isIndonesianCity } from "../id-cities";

export interface WebsiteNarrativeInput {
  monthLabel: string;
  prevMonthLabel: string;
  users: number | null;
  pageviews: number | null;
  pagePaths: number;
  sessions: number | null;
  prevSessions: number | null;
  channels: { label: string; sessions: number; share: number | null; prevSessions: number | null }[];
  cities: { city: string; users: number }[];
  notSetSessions: number | null;
  gsc: { clicks: number | null; impressions: number | null; ctr: number | null; position: number | null; prevCtr: number | null };
}

const n = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const change = (cur: number, prev: number) => `${cur >= prev ? "rose" : "fell"} ${pct(Math.abs((cur - prev) / prev))}`;
const ORDINAL = ["Largest", "Second-largest", "Third-largest"];

export function websiteFindings(i: WebsiteNarrativeInput): string[] {
  const out: string[] = [];
  const [a, b] = i.channels;
  if (a) out.push(`${a.label} generated ${n(a.sessions)} sessions (${pct(a.share ?? 0)})${b ? `, followed by ${b.label} at ${n(b.sessions)} (${pct(b.share ?? 0)})` : ""}.`);
  if (i.pageviews != null && i.users)
    out.push(`The website recorded ${n(i.pageviews)} page views across ${n(i.pagePaths)} page paths and ${n(i.users)} active users (${(i.pageviews / i.users).toFixed(2)} views per user).`);
  const top = i.cities[0];
  if (top && i.users) out.push(`${top.city} is the largest city audience with ${n(top.users)} active users (${pct(top.users / i.users)} of site-wide active users).`);
  if (i.sessions != null && i.prevSessions) out.push(`Sessions ${change(i.sessions, i.prevSessions)} vs ${i.prevMonthLabel} (${n(i.prevSessions)} → ${n(i.sessions)}).`);
  for (const c of i.channels)
    if (c.prevSessions != null && c.prevSessions >= 50 && Math.abs(c.sessions - c.prevSessions) / c.prevSessions > 0.5)
      out.push(`${c.label} sessions ${change(c.sessions, c.prevSessions)} MoM (${n(c.prevSessions)} → ${n(c.sessions)}).`);
  if (i.notSetSessions && i.sessions && i.notSetSessions / i.sessions > 0.05)
    out.push(`The landing-page dimension was “(not set)” for ${n(i.notSetSessions)} sessions (${pct(i.notSetSessions / i.sessions)}); review landing-page tagging.`);
  const g = i.gsc;
  if (g.clicks != null && g.impressions != null)
    out.push(`Google Search Console recorded ${n(g.clicks)} clicks and ${n(g.impressions)} impressions (${pct(g.ctr ?? 0, 2)} CTR)${g.position != null ? ` at an average position of ${g.position.toFixed(1)}` : ""}.`);
  if (g.ctr != null && g.prevCtr != null && g.prevCtr - g.ctr > 0.02)
    out.push(`Search CTR fell ${((g.prevCtr - g.ctr) * 100).toFixed(1)} pp vs ${i.prevMonthLabel}; review titles and meta descriptions of top-impression pages.`);
  const odd = i.cities.filter((c) => !isIndonesianCity(c.city)).map((c) => c.city);
  if (odd.length)
    out.push(`City attribution is approximate. Treat ${odd.join(" and ")} as ${odd.length > 1 ? "locations" : "a location"} to validate before interpretation.`);
  return out;
}

export function cityNotes(cities: { city: string; users: number }[], siteUsers: number | null): { readout: string; note: string }[] {
  return cities.map((c, idx) => {
    if (!isIndonesianCity(c.city))
      return { readout: "Unusual location for the target audience; validate before interpretation.", note: "Not in the Indonesian city reference list; validate before interpreting." };
    const base = idx < ORDINAL.length ? `${ORDINAL[idx]} city audience` : "Smaller city audience";
    return { readout: idx === 0 && siteUsers ? `${base}; ${pct(c.users / siteUsers)} of site-wide active users.` : `${base}.`, note: "City attribution is approximate in GA4." };
  });
}

export function geoReadout(cities: { city: string; users: number }[], siteUsers: number | null): string[] {
  if (!cities.length || !siteUsers) return [];
  const top3 = cities.slice(0, 3);
  const top3Users = top3.reduce((a, c) => a + c.users, 0);
  const shown = cities.reduce((a, c) => a + c.users, 0);
  return [
    `${cities[0].city} is the largest city audience: ${n(cities[0].users)} active users, or ${pct(cities[0].users / siteUsers)} of the site-wide total.`,
    `${top3.map((c) => c.city).join(", ")} combine for ${n(top3Users)} active users (${pct(top3Users / siteUsers)} of the site-wide total).`,
    `The ${cities.length} cities shown combine for ${n(shown)} active users (${pct(shown / siteUsers)} of the site-wide total).`,
    "GA4 city attribution is approximate; small or unexpected locations should be validated before interpretation.",
  ];
}
```

- [ ] **Step 5: Jalankan tes, pastikan lolos**

Run: `npx vitest run tests/reports-website.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/reports/id-cities.ts lib/reports/channels/website-narrative.ts tests/reports-website.test.ts
git commit -m "Narasi laporan Website (temuan, watchout, catatan kota)"
```

---

### Task 6: Data laporan Website (`build`)

**Files:**
- Create: `lib/reports/channels/website.ts`
- Create: `lib/reports/channels/index.ts`

Daftar penanda yang disediakan (dipakai template di Task 8):

| Penanda | Isi |
|---|---|
| `{{month_label}}` `{{period}}` `{{prev_month_label}}` | "September 2026", "1–30 September 2026", "August 2026" |
| `{{kpi.<key>.label/value/change}}` | 12 kartu `WEBSITE_KPIS` |
| `{{kudus_users}}` `{{kudus_share}}` | active users Kudus & porsinya |
| `{{#mix.*}}` | Executive Summary: `ch_name ch_sessions ch_share ch_er city_name city_users city_share` (baris = max channel/7 kota) |
| `{{#channels.*}}` + `{{total.*}}` | `name sessions share engaged er avg_time events events_per_session`; total: `sessions engaged er avg_time events events_per_session` |
| `{{#cities.*}}` | `rank city users share_site share_shown readout note` (top 10) + `{{cities.shown_users}} {{cities.shown_share}} {{cities.gap_users}} {{cities.gap_share}}` |
| `{{#pages.*}}` | `path views users views_per_user avg_time events` (top 10) + `{{pages.count}} {{pages.total_views}} {{pages.total_users}} {{pages.total_vpu}} {{pages.total_avg_time}} {{pages.total_events}}` |
| `{{#landing.*}}` | `path sessions users new_users avg_time` (top 10) + `{{landing.count}} {{landing.total_sessions}} {{landing.total_users}} {{landing.total_new_users}} {{landing.total_avg_time}}` |
| `{{gsc.clicks}} {{gsc.impressions}} {{gsc.ctr}} {{gsc.position}}` | total GSC |
| `{{#gsc_daily.*}}` | `date clicks impressions ctr position` |
| `{{#queries.*}}` `{{#gsc_pages.*}}` | `query/url clicks impressions ctr position` (maks. 100) |
| `{{#devices.*}}` `{{#countries.*}}` | `name clicks impressions ctr position` |
| `{{#findings.text}}` `{{#geo.text}}` | narasi |

- [ ] **Step 1: Implementasi**

`lib/reports/channels/website.ts`:

```ts
// Data laporan Website: angka KPI dari summary dashboard (identik dengan dashboard) + tabel detail dari DB.
import { prisma } from "../../db";
import { getMonthAndPrev } from "../../data/summary";
import { daysInMonth, prevMonth } from "../../month";
import { kpiData, WEBSITE_KPIS } from "../kpi";
import type { Cell, ReportChannel, ReportData } from "../types";
import { cityNotes, geoReadout, websiteFindings } from "./website-narrative";

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const enMonth = (m: string) => `${EN_MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const div = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : a / b);
const sumOf = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

export async function buildWebsite(month: string): Promise<ReportData> {
  const prev = prevMonth(month);
  const [{ cur, prev: prevBundle }, channels, prevChannels, pages, landings, cityRows, gscDaily, queries, gscPages, devices, countries] = await Promise.all([
    getMonthAndPrev(month),
    prisma.ga4Channel.findMany({ where: { month }, orderBy: { sessions: "desc" } }),
    prisma.ga4Channel.findMany({ where: { month: prev } }),
    prisma.ga4Page.findMany({ where: { month } }),
    prisma.ga4Landing.findMany({ where: { month }, orderBy: { sessions: "desc" } }),
    prisma.breakdown.findMany({ where: { month, channel: "website", dimension: "city", metric: "activeUsers" }, orderBy: { value: "desc" } }),
    prisma.gscDaily.findMany({ where: { month }, orderBy: { date: "asc" } }),
    prisma.gscQuery.findMany({ where: { month }, orderBy: [{ clicks: "desc" }, { impressions: "desc" }], take: 100 }),
    prisma.gscPage.findMany({ where: { month }, orderBy: [{ clicks: "desc" }, { impressions: "desc" }], take: 100 }),
    prisma.breakdown.findMany({ where: { month, channel: "website", dimension: "device" } }),
    prisma.breakdown.findMany({ where: { month, channel: "website", dimension: "country" } }),
  ]);
  const w = cur.website;
  const p = prevBundle.website.hasData ? prevBundle.website : null;
  const kpi = kpiData(WEBSITE_KPIS, w, p);

  const totalSessions = sumOf(channels.map((c) => c.sessions));
  const totalEvents = sumOf(channels.map((c) => c.eventCount));
  const channelRows = channels.map((c) => ({
    name: c.channel,
    sessions: c.sessions,
    share: div(c.sessions, totalSessions),
    engaged: c.engagedSessions ?? null,
    er: c.engagementRate ?? null,
    avg_time: c.avgEngagementTime != null ? Math.round(c.avgEngagementTime) : null,
    events: c.eventCount ?? null,
    events_per_session: div(c.eventCount, c.sessions),
  }));

  // halaman: gabung path ganda (sama dengan dashboard)
  const pageMap = new Map<string, { views: number; users: number; time: number; events: number }>();
  for (const pg of pages) {
    const a = pageMap.get(pg.path) ?? { views: 0, users: 0, time: 0, events: 0 };
    a.views += pg.views;
    a.users += pg.activeUsers ?? 0;
    a.time += (pg.avgEngagementTime ?? 0) * (pg.activeUsers ?? 0);
    a.events += pg.eventCount ?? 0;
    pageMap.set(pg.path, a);
  }
  const pageList = [...pageMap.entries()].sort((a, b) => b[1].views - a[1].views);
  const pageRows = pageList.slice(0, 10).map(([path, a]) => ({ path, views: a.views, users: a.users, views_per_user: div(a.views, a.users), avg_time: a.users ? Math.round(a.time / a.users) : null, events: a.events }));

  const landingRows = landings.slice(0, 10).map((l) => ({ path: l.path, sessions: l.sessions, users: l.activeUsers ?? null, new_users: l.newUsers ?? null, avg_time: l.avgEngagementTime != null ? Math.round(l.avgEngagementTime) : null }));
  const notSet = landings.find((l) => l.path === "(not set)")?.sessions ?? null;

  const cities = cityRows.slice(0, 10).map((c) => ({ city: c.label, users: c.value }));
  const notes = cityNotes(cities, w.users);
  const shownUsers = sumOf(cities.map((c) => c.users));
  const kudus = cityRows.find((c) => c.label.toLowerCase() === "kudus")?.value ?? null;

  const bd = (rows: typeof devices) => {
    const names = [...new Set(rows.map((r) => r.label))];
    return names
      .map((name) => {
        const clicks = rows.find((r) => r.label === name && r.metric === "clicks")?.value ?? 0;
        const impressions = rows.find((r) => r.label === name && r.metric === "impressions")?.value ?? 0;
        return { name, clicks, impressions, ctr: div(clicks, impressions), position: null as Cell };
      })
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  };

  const findings = websiteFindings({
    monthLabel: enMonth(month),
    prevMonthLabel: enMonth(prev),
    users: w.users,
    pageviews: w.pageviews,
    pagePaths: pageMap.size,
    sessions: w.sessions,
    prevSessions: p?.sessions ?? null,
    channels: channelRows.map((c) => ({ label: c.name, sessions: c.sessions, share: c.share, prevSessions: prevChannels.find((x) => x.channel === c.name)?.sessions ?? null })),
    cities,
    notSetSessions: notSet,
    gsc: { clicks: w.gscClicks, impressions: w.gscImpressions, ctr: w.gscCtr, position: w.gscPosition, prevCtr: p?.gscCtr ?? null },
  });

  const mixLen = Math.max(channelRows.length, Math.min(cities.length, 7));
  const mix = Array.from({ length: mixLen }, (_, i) => ({
    ch_name: channelRows[i]?.name ?? "",
    ch_sessions: channelRows[i]?.sessions ?? null,
    ch_share: channelRows[i]?.share ?? null,
    ch_er: channelRows[i]?.er ?? null,
    city_name: i < 7 ? (cities[i]?.city ?? "") : "",
    city_users: i < 7 ? (cities[i]?.users ?? null) : null,
    city_share: i < 7 && cities[i] ? div(cities[i].users, w.users) : null,
  }));

  const days = daysInMonth(month);
  const values: Record<string, Cell> = {
    month_label: enMonth(month),
    prev_month_label: enMonth(prev),
    period: `1–${days.length} ${enMonth(month)}`,
    generated_at: new Date().toISOString().slice(0, 10),
    ...kpi.values,
    kudus_users: kudus,
    kudus_share: div(kudus, w.users),
    "total.sessions": totalSessions,
    "total.engaged": sumOf(channels.map((c) => c.engagedSessions)),
    "total.er": w.engagementRate,
    "total.avg_time": w.avgEngagementTime != null ? Math.round(w.avgEngagementTime) : null,
    "total.events": totalEvents,
    "total.events_per_session": div(totalEvents, totalSessions),
    "cities.shown_users": shownUsers,
    "cities.shown_share": div(shownUsers, w.users),
    "cities.gap_users": w.users != null ? w.users - shownUsers : null,
    "cities.gap_share": w.users ? (w.users - shownUsers) / w.users : null,
    "pages.count": pageMap.size,
    "pages.total_views": w.pageviews,
    "pages.total_users": w.users,
    "pages.total_vpu": div(w.pageviews, w.users),
    "pages.total_avg_time": pageList.length ? Math.round(sumOf(pageList.map(([, a]) => a.time)) / Math.max(1, sumOf(pageList.map(([, a]) => a.users)))) : null,
    "pages.total_events": sumOf(pageList.map(([, a]) => a.events)),
    "landing.count": landings.length,
    "landing.total_sessions": w.sessions,
    "landing.total_users": w.users,
    "landing.total_new_users": w.newUsers,
    "landing.total_avg_time": w.avgEngagementTime != null ? Math.round(w.avgEngagementTime) : null,
    "gsc.clicks": w.gscClicks,
    "gsc.impressions": w.gscImpressions,
    "gsc.ctr": w.gscCtr,
    "gsc.position": w.gscPosition,
  };

  return {
    values,
    tones: kpi.tones,
    tables: {
      mix,
      channels: channelRows,
      cities: cities.map((c, i) => ({ rank: i + 1, city: c.city, users: c.users, share_site: div(c.users, w.users), share_shown: div(c.users, shownUsers), readout: notes[i].readout, note: notes[i].note })),
      pages: pageRows,
      landing: landingRows,
      gsc_daily: gscDaily.map((d) => ({ date: d.date, clicks: d.clicks, impressions: d.impressions, ctr: d.ctr, position: d.position })),
      queries: queries.map((q) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position })),
      gsc_pages: gscPages.map((q) => ({ url: q.url, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position })),
      devices: bd(devices),
      countries: bd(countries),
      findings: findings.map((text) => ({ text })),
      geo: geoReadout(cities, w.users).map((text) => ({ text })),
    },
  };
}

export const website: ReportChannel = { id: "website", title: "Website", templateEnv: "REPORT_TEMPLATE_WEBSITE", build: buildWebsite };
export const monthTitle = (month: string) => enMonth(month);
```

`lib/reports/channels/index.ts`:

```ts
import type { ReportChannel, ReportChannelId } from "../types";
import { website } from "./website";

/** Channel laporan yang sudah tersedia (tahap 1: Website). */
export const REPORT_CHANNELS: ReportChannel[] = [website];
export const reportChannel = (id: string): ReportChannel | undefined => REPORT_CHANNELS.find((c) => c.id === (id as ReportChannelId));
```

- [ ] **Step 2: Cek data September tanpa Google**

Buat `scripts/_check-website-report.ts` (sementara, tidak di-commit):

```ts
import { buildWebsite } from "@/lib/reports/channels/website";
(async () => {
  const d = await buildWebsite("2026-09");
  console.log(d.values["kpi.users.value"], d.values["kpi.sessions.change"], d.values.period);
  console.log(Object.fromEntries(Object.entries(d.tables).map(([k, v]) => [k, v.length])));
  console.log(d.tables.findings.map((f) => f.text));
})();
```

Run: `npx tsx scripts/_check-website-report.ts && rm scripts/_check-website-report.ts`
Expected: `835 '↑ … vs last month' 1–30 September 2026`, jumlah baris tiap tabel (channels 7, gsc_daily 30, …), dan daftar temuan berbahasa Inggris.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit -p . && npx eslint lib/reports`
Expected: tanpa output.

- [ ] **Step 4: Commit**

```bash
git add lib/reports/channels/website.ts lib/reports/channels/index.ts
git commit -m "Data laporan Website: KPI, tabel detail, narasi"
```

---

### Task 7: Lapisan Google (`sheets.ts`)

**Files:**
- Create: `lib/reports/engine/sheets.ts`

- [ ] **Step 1: Implementasi**

```ts
// Google Drive/Sheets untuk laporan. Hanya menulis ke file buatan app (scope drive.file) — file user tidak disentuh.
import { google, type sheets_v4 } from "googleapis";
import { authorizedClient, DRIVE_FILE_SCOPE, grantedScopes } from "../../connectors/google-oauth";
import type { Plan, SheetGrid } from "./tokens";
import type { Tone } from "../types";

export class ReportError extends Error {}

export async function reportClients() {
  const auth = await authorizedClient("sheets");
  if (!auth) throw new ReportError("Akun Google belum terhubung. Hubungkan di Pengaturan → Connectors → Google Sheets.");
  if (!(await grantedScopes("sheets")).includes(DRIVE_FILE_SCOPE))
    throw new ReportError("Akun Google belum memberi izin membuat file laporan. Hubungkan ulang Google Sheets di Pengaturan → Connectors dan centang semua izin.");
  return { drive: google.drive({ version: "v3", auth: auth.client as never }), sheets: google.sheets({ version: "v4", auth: auth.client as never }) };
}
type Clients = Awaited<ReturnType<typeof reportClients>>;

/** Salin file (template atau laporan user) → file baru milik app. File sumber tidak diubah. */
export async function copyFile(c: Clients, sourceId: string, name: string, folderId?: string): Promise<{ id: string; url: string }> {
  const src = await c.drive.files.get({ fileId: sourceId, fields: "parents" });
  const parents = folderId ? [folderId] : (src.data.parents ?? undefined);
  const res = await c.drive.files.copy({ fileId: sourceId, requestBody: { name, parents }, fields: "id,webViewLink" });
  return { id: res.data.id!, url: res.data.webViewLink ?? `https://docs.google.com/spreadsheets/d/${res.data.id}/edit` };
}

export async function renameFile(c: Clients, fileId: string, name: string) {
  await c.drive.files.update({ fileId, requestBody: { name } });
}

const cellText = (v: sheets_v4.Schema$CellData | undefined): string => {
  const u = v?.userEnteredValue;
  if (!u) return "";
  return u.stringValue ?? u.formulaValue ?? (u.numberValue != null ? String(u.numberValue) : u.boolValue != null ? String(u.boolValue) : "");
};

/** Isi sel (nilai yang diketik) + merge semua sheet. */
export async function readGrids(c: Clients, spreadsheetId: string): Promise<SheetGrid[]> {
  const res = await c.sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: true,
    fields: "sheets(properties(sheetId,title),merges,data(rowData(values(userEnteredValue))))",
  });
  return (res.data.sheets ?? []).map((s) => ({
    sheetId: s.properties!.sheetId!,
    title: s.properties!.title!,
    rows: (s.data?.[0]?.rowData ?? []).map((r) => (r.values ?? []).map(cellText)),
    merges: (s.merges ?? []).map((m) => ({ startRow: m.startRowIndex!, endRow: m.endRowIndex!, startCol: m.startColumnIndex!, endCol: m.endColumnIndex! })),
  }));
}

const TONE_COLORS: Record<Tone, { fg: string; bg: string }> = {
  good: { fg: "#0B7A0B", bg: "#E6F4E6" },
  bad: { fg: "#B42318", bg: "#FDECEA" },
  flat: { fg: "#5F6368", bg: "#F1F3F4" },
  none: { fg: "#5F6368", bg: "#FFFFFF" },
};
const rgb = (hex: string) => ({ red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 });
const col = (i: number) => String.fromCharCode(65 + i);
const quote = (t: string) => `'${t.replace(/'/g, "''")}'`;

/** Jalankan rencana: sisip baris (mewarisi format) → merge → tulis nilai (RAW, angka tetap angka) → warna tone. */
export async function applyPlan(c: Clients, spreadsheetId: string, plan: Plan, grids: SheetGrid[]) {
  const structural: sheets_v4.Schema$Request[] = [
    ...plan.inserts.map((i) => ({ insertDimension: { range: { sheetId: i.sheetId, dimension: "ROWS", startIndex: i.at, endIndex: i.at + i.count }, inheritFromBefore: true } })),
    ...plan.merges.map((m) => ({ mergeCells: { range: { sheetId: m.sheetId, startRowIndex: m.startRow, endRowIndex: m.endRow, startColumnIndex: m.startCol, endColumnIndex: m.endCol }, mergeType: "MERGE_ALL" } })),
  ];
  // format baris sisipan = salin format baris contoh (insertDimension hanya mewarisi sebagian)
  for (const i of plan.inserts)
    structural.push({
      copyPaste: {
        source: { sheetId: i.sheetId, startRowIndex: i.at - 1, endRowIndex: i.at },
        destination: { sheetId: i.sheetId, startRowIndex: i.at, endRowIndex: i.at + i.count },
        pasteType: "PASTE_FORMAT",
      },
    });
  if (structural.length) await c.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: structural } });

  for (let i = 0; i < plan.writes.length; i += 500) {
    const chunk = plan.writes.slice(i, i + 500);
    await c.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: chunk.map((w) => ({ range: `${quote(w.sheetTitle)}!${col(w.col)}${w.row + 1}`, values: [[w.value ?? ""]] })) },
    });
  }

  const sheetId = new Map(grids.map((g) => [g.title, g.sheetId]));
  const toneReqs = plan.writes
    .filter((w) => w.tone)
    .map((w) => ({
      repeatCell: {
        range: { sheetId: sheetId.get(w.sheetTitle)!, startRowIndex: w.row, endRowIndex: w.row + 1, startColumnIndex: w.col, endColumnIndex: w.col + 1 },
        cell: { userEnteredFormat: { backgroundColor: rgb(TONE_COLORS[w.tone!].bg), textFormat: { foregroundColor: rgb(TONE_COLORS[w.tone!].fg) } } },
        fields: "userEnteredFormat(backgroundColor,textFormat.foregroundColor)",
      },
    }));
  if (toneReqs.length) await c.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: toneReqs } });
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit -p . && npx eslint lib/reports/engine/sheets.ts`
Expected: tanpa output.

- [ ] **Step 3: Commit**

```bash
git add lib/reports/engine/sheets.ts
git commit -m "Report engine: lapisan Google Drive/Sheets (copy, baca grid, jalankan plan)"
```

---

### Task 8: Master template Website (sekali jalan, file baru)

**Files:**
- Create: `scripts/report-template-website.ts`

Script menyalin laporan September user (`18g9R_AadxFlWlCnp6i0Ba27qq_s8I-DVsimEdH6G6GM`) ke **file baru**
"TEMPLATE – MKK Website Monthly Performance Report", lalu di salinan: hapus baris contoh tabel kecuali satu,
tulis penanda, ganti strip KPI (baris 4–6 Executive Summary) dengan blok kartu KPI, rapikan (sembunyikan gridlines,
freeze header tabel, format angka seragam, angka rata kanan, subjudul baru tanpa referensi "supplied PDF").
Tata letak sumber diambil dari dump struktur (19 Okt 2026).

- [ ] **Step 1: Implementasi**

```ts
// Sekali jalan: buat master template laporan Website dari laporan September user.
// npm exec tsx scripts/report-template-website.ts -- --from=<fileId user>
// Sumber hanya DISALIN (file user tidak diubah); semua perubahan di file baru milik app.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

type Req = Record<string, unknown>;

async function main() {
  const from = process.argv.find((a) => a.startsWith("--from="))?.split("=")[1];
  if (!from) throw new Error("--from=<ID laporan September> wajib");
  const { reportClients, copyFile, readGrids } = await import("../lib/reports/engine/sheets");
  const c = await reportClients();
  const file = await copyFile(c, from, "TEMPLATE – MKK Website Monthly Performance Report");
  const id = file.id;
  const grids = await readGrids(c, id);
  const sid = (title: string) => grids.find((g) => g.title === title)!.sheetId;
  // baris terakhir yang berisi (1-based); grid API mengembalikan baris kosong sampai akhir sheet
  const lastRow = (title: string) => {
    const rows = grids.find((g) => g.title === title)!.rows;
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].some((v) => v)) return i + 1;
    return 1;
  };

  const requests: Req[] = [];
  const values: { range: string; values: (string | number)[][] }[] = [];
  const put = (sheet: string, a1: string, row: (string | number)[]) => values.push({ range: `'${sheet.replace(/'/g, "''")}'!${a1}`, values: [row] });
  // hapus baris (1-based inklusif) — diproses dari bawah ke atas per sheet
  const del = (sheet: string, from1: number, to1: number) =>
    requests.push({ deleteDimension: { range: { sheetId: sid(sheet), dimension: "ROWS", startIndex: from1 - 1, endIndex: to1 } } });
  const numFmt = (sheet: string, r1: number, c0: number, c1: number, pattern: string, type = "NUMBER") =>
    requests.push({
      repeatCell: {
        range: { sheetId: sid(sheet), startRowIndex: r1 - 1, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 },
        cell: { userEnteredFormat: { numberFormat: { type, pattern }, horizontalAlignment: "RIGHT" } },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    });
  const tidy = (sheet: string, frozen: number) =>
    requests.push({ updateSheetProperties: { properties: { sheetId: sid(sheet), gridProperties: { hideGridlines: true, frozenRowCount: frozen } }, fields: "gridProperties(hideGridlines,frozenRowCount)" } });

  // ── 02 Traffic Acquisition: header r4, total r5, data r6–12 → satu baris contoh r6
  const TA = "02 Traffic Acquisition";
  del(TA, 7, 12);
  put(TA, "A2", ["GA4 · {{period}} · all channel groups"]);
  put(TA, "A5", ["TOTAL", "{{total.sessions}}", 1, "{{total.engaged}}", "{{total.er}}", "{{total.avg_time}}", "{{total.events}}", "{{total.events_per_session}}"]);
  put(TA, "A6", ["{{#channels.name}}", "{{#channels.sessions}}", "{{#channels.share}}", "{{#channels.engaged}}", "{{#channels.er}}", "{{#channels.avg_time}}", "{{#channels.events}}", "{{#channels.events_per_session}}"]);
  for (const r of [5, 6]) {
    numFmt(TA, r, 1, 2, "#,##0");
    numFmt(TA, r, 2, 3, "0.0%", "PERCENT");
    numFmt(TA, r, 3, 4, "#,##0");
    numFmt(TA, r, 4, 5, "0.0%", "PERCENT");
    numFmt(TA, r, 5, 6, '0" sec"');
    numFmt(TA, r, 6, 7, "#,##0");
    numFmt(TA, r, 7, 8, "0.00");
  }
  tidy(TA, 4);

  // ── 03 Visitor Cities: data r5–11 → contoh r5; total r12; site r14; gap r15; readout r18–21 → contoh r18
  const VC = "03 Visitor Cities";
  del(VC, 19, 21);
  del(VC, 6, 11);
  put(VC, "A2", ["GA4 · Active users by city · {{period}} · top 10 cities"]);
  put(VC, "A4", ["Rank", "City", "Active Users", "Share of Site Active Users", "Share of Cities Shown", "Audience Readout", "Data Quality Note"]);
  put(VC, "A5", ["{{#cities.rank}}", "{{#cities.city}}", "{{#cities.users}}", "{{#cities.share_site}}", "{{#cities.share_shown}}", "{{#cities.readout}}", "{{#cities.note}}"]);
  put(VC, "A6", ["", "CITIES SHOWN", "{{cities.shown_users}}", "{{cities.shown_share}}", 1, "Sum of the city rows shown.", "Not an exhaustive city list."]);
  put(VC, "A8", ["SITE-WIDE ACTIVE USERS", "", "{{pages.total_users}}", 1, "", "GA4 site-wide active users."]);
  put(VC, "A9", ["GAP VS CITIES SHOWN", "", "{{cities.gap_users}}", "{{cities.gap_share}}", "", "Users in cities outside the list shown (or unattributed)."]);
  put(VC, "A12", ["{{#geo.text}}"]);
  for (const r of [5, 6, 8, 9]) {
    numFmt(VC, r, 2, 3, "#,##0");
    numFmt(VC, r, 3, 5, "0.0%", "PERCENT");
  }
  tidy(VC, 4);

  // ── 04 Page Performance: total r5, data r6–15 → contoh r6
  const PP = "04 Page Performance";
  del(PP, 7, 15);
  put(PP, "A2", ["GA4 · total plus top 10 of {{pages.count}} page paths · {{period}}"]);
  put(PP, "A5", ["TOTAL (all {{pages.count}} paths)", "{{pages.total_views}}", "{{pages.total_users}}", "{{pages.total_vpu}}", "{{pages.total_avg_time}}", "{{pages.total_events}}"]);
  put(PP, "A6", ["{{#pages.path}}", "{{#pages.views}}", "{{#pages.users}}", "{{#pages.views_per_user}}", "{{#pages.avg_time}}", "{{#pages.events}}"]);
  for (const r of [5, 6]) {
    numFmt(PP, r, 1, 3, "#,##0");
    numFmt(PP, r, 3, 4, "0.00");
    numFmt(PP, r, 4, 5, '0" sec"');
    numFmt(PP, r, 5, 6, "#,##0");
  }
  tidy(PP, 4);

  // ── 05 Landing Pages: total r5, data r6–15 → contoh r6
  const LP = "05 Landing Pages";
  del(LP, 7, 15);
  put(LP, "A2", ["GA4 · total plus top 10 of {{landing.count}} landing pages · {{period}}"]);
  put(LP, "A5", ["TOTAL (all {{landing.count}} landing pages)", "{{landing.total_sessions}}", "{{landing.total_users}}", "{{landing.total_new_users}}", "{{landing.total_avg_time}}"]);
  put(LP, "A6", ["{{#landing.path}}", "{{#landing.sessions}}", "{{#landing.users}}", "{{#landing.new_users}}", "{{#landing.avg_time}}"]);
  for (const r of [5, 6]) {
    numFmt(LP, r, 1, 4, "#,##0");
    numFmt(LP, r, 4, 5, '0" sec"');
  }
  tidy(LP, 4);

  // ── 06 Search Console: total r5; harian r10–39 → contoh r10
  const SC = "06 Search Console";
  del(SC, 11, 39);
  put(SC, "A2", ["Google Search Console · Web search · {{period}} · separate from GA4 sessions and users"]);
  put(SC, "A5", ["{{gsc.clicks}}", "{{gsc.impressions}}", "{{gsc.ctr}}", "{{gsc.position}}"]);
  put(SC, "A10", ["{{#gsc_daily.date}}", "{{#gsc_daily.clicks}}", "{{#gsc_daily.impressions}}", "{{#gsc_daily.ctr}}", "{{#gsc_daily.position}}"]);
  for (const r of [5, 10]) {
    numFmt(SC, r, 0, 2, "#,##0");
    numFmt(SC, r, 2, 3, "0.00%", "PERCENT");
    numFmt(SC, r, 3, 4, "0.00");
  }
  numFmt(SC, 10, 1, 3, "#,##0");
  numFmt(SC, 10, 3, 4, "0.00%", "PERCENT");
  numFmt(SC, 10, 4, 5, "0.00");
  tidy(SC, 0);

  // ── 07 Search Queries & 08 Search Pages: data r5.. → contoh r5
  for (const [sheet, table, label, last] of [
    ["07 Search Queries", "queries", "query", 65],
    ["08 Search Pages", "gsc_pages", "url", 113],
  ] as const) {
    del(sheet, 6, last);
    put(sheet, "A2", [`Web search · ${table === "queries" ? "top 100 queries" : "top 100 pages"} · {{period}} · rows may not sum to property totals`]);
    put(sheet, "A5", [`{{#${table}.${label}}}`, `{{#${table}.clicks}}`, `{{#${table}.impressions}}`, `{{#${table}.ctr}}`, `{{#${table}.position}}`]);
    numFmt(sheet, 5, 1, 3, "#,##0");
    numFmt(sheet, 5, 3, 4, "0.00%", "PERCENT");
    numFmt(sheet, 5, 4, 5, "0.00");
    tidy(sheet, 4);
  }

  // ── 09 GSC Devices & Countries: devices r5–7 → contoh r5; negara r12.. → contoh r12 (setelah hapus r6–7 → r10)
  const DC = "09 GSC Devices & Countries";
  if (lastRow(DC) >= 13) del(DC, 13, lastRow(DC));
  del(DC, 6, 7);
  put(DC, "A2", ["GSC Web search · {{period}} · search-result dimensions, not GA4 visitor dimensions"]);
  put(DC, "A5", ["{{#devices.name}}", "{{#devices.clicks}}", "{{#devices.impressions}}", "{{#devices.ctr}}", "—"]);
  put(DC, "A10", ["{{#countries.name}}", "{{#countries.clicks}}", "{{#countries.impressions}}", "{{#countries.ctr}}", "—"]);
  for (const r of [5, 10]) {
    numFmt(DC, r, 1, 3, "#,##0");
    numFmt(DC, r, 3, 4, "0.00%", "PERCENT");
  }
  tidy(DC, 0);

  // ── 10 Metric Guide & Sources: periode
  put("10 Metric Guide & Sources", "C6", ["{{period}}"]);
  tidy("10 Metric Guide & Sources", 4);

  // ── 01 Executive Summary (diproses terakhir; baris dihapus bawah→atas)
  const ES = "01 Executive Summary";
  del(ES, 20, 26); // temuan r19–26 → contoh r19
  del(ES, 11, 16); // mix r10–16 → contoh r10
  del(ES, 4, 6); // strip KPI lama
  // setelah hapus: r4 kosong, r5 judul mix, r6 header mix, r7 contoh mix, r9 judul temuan, r10 contoh temuan, r12 coverage, r13 isi
  put(ES, "A1", ["MAIN KE KUDUS | WEBSITE MONTHLY PERFORMANCE REPORT · {{month_label}}"]);
  put(ES, "A2", ["Reporting period: {{period}} | Primary source: GA4 | Supporting search visibility: Google Search Console"]);
  put(ES, "A7", ["{{#mix.ch_name}}", "{{#mix.ch_sessions}}", "{{#mix.ch_share}}", "{{#mix.ch_er}}", "", "{{#mix.city_name}}", "{{#mix.city_users}}", "{{#mix.city_share}}", ""]);
  put(ES, "F6", ["City", "Active Users", "Share of Site", ""]);
  put(ES, "A10", ["{{#findings.text}}"]);
  put(ES, "A12", ["DATA NOTES"]);
  put(ES, "A13", ["All figures are pulled from the GA4 and Search Console APIs for {{period}}. City attribution in GA4 is approximate. Kudus: {{kudus_users}} active users."]);
  numFmt(ES, 7, 1, 2, "#,##0");
  numFmt(ES, 7, 2, 4, "0.0%", "PERCENT");
  numFmt(ES, 7, 6, 7, "#,##0");
  numFmt(ES, 7, 7, 8, "0.0%", "PERCENT");
  tidy(ES, 0);

  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
  await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data: values } });

  // kartu: kolom A:B, C:D, E:F, G:I; baris kartu mulai r5, r10, r15 (label, nilai, perubahan, spasi)
  const KPIS = ["users", "new_users", "sessions", "views", "engagement_rate", "bounce_rate", "avg_engagement_time", "engaged_sessions", "gsc_clicks", "gsc_impressions", "gsc_ctr", "gsc_position"];
  const COLS: [number, number][] = [[0, 2], [2, 4], [4, 6], [6, 9]];
  const FMT: Record<string, [string, string]> = { engagement_rate: ["PERCENT", "0.00%"], bounce_rate: ["PERCENT", "0.00%"], gsc_ctr: ["PERCENT", "0.00%"], gsc_position: ["NUMBER", "0.0"] };
  // Blok kartu KPI disisipkan SETELAH semua nilai di atas ditulis (koordinat di atas memakai posisi sebelum sisipan):
  // 15 baris di r4 = 3 baris kartu × (label, nilai, perubahan, spasi) + spasi
  const cardReqs: Req[] = [{ insertDimension: { range: { sheetId: sid(ES), dimension: "ROWS", startIndex: 3, endIndex: 18 }, inheritFromBefore: false } }];
  const cardVals: { range: string; values: string[][] }[] = [];
  const white = { red: 1, green: 1, blue: 1 };
  const border = { style: "SOLID", color: { red: 0.85, green: 0.86, blue: 0.88 } };
  KPIS.forEach((k, i) => {
    const top = 4 + Math.floor(i / 4) * 5; // 0-based: r5, r10, r15
    const [c0, c1] = COLS[i % 4];
    const range = (r: number) => ({ sheetId: sid(ES), startRowIndex: top + r, endRowIndex: top + r + 1, startColumnIndex: c0, endColumnIndex: c1 });
    for (let r = 0; r < 3; r++) cardReqs.push({ mergeCells: { range: range(r), mergeType: "MERGE_ALL" } });
    cardReqs.push({
      updateBorders: { range: { sheetId: sid(ES), startRowIndex: top, endRowIndex: top + 3, startColumnIndex: c0, endColumnIndex: c1 }, top: border, bottom: border, left: border, right: border },
    });
    cardReqs.push({ repeatCell: { range: range(0), cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontSize: 9, foregroundColor: { red: 0.37, green: 0.39, blue: 0.41 } }, padding: { left: 8 } } }, fields: "userEnteredFormat(backgroundColor,textFormat,padding)" } });
    const [type, pattern] = FMT[k] ?? ["NUMBER", "#,##0"];
    cardReqs.push({ repeatCell: { range: range(1), cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontSize: 18, bold: true }, horizontalAlignment: "LEFT", padding: { left: 8 }, numberFormat: { type, pattern } } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding,numberFormat)" } });
    cardReqs.push({ repeatCell: { range: range(2), cell: { userEnteredFormat: { textFormat: { fontSize: 9 }, padding: { left: 8 } } }, fields: "userEnteredFormat(textFormat,padding)" } });
    const a = (r: number) => `'${ES}'!${String.fromCharCode(65 + c0)}${top + r + 1}`;
    cardVals.push({ range: a(0), values: [[`{{kpi.${k}.label}}`]] }, { range: a(1), values: [[`{{kpi.${k}.value}}`]] }, { range: a(2), values: [[`{{kpi.${k}.change}}`]] });
  });
  for (const [r, px] of [[1, 34]] as const) for (let b = 0; b < 3; b++) cardReqs.push({ updateDimensionProperties: { range: { sheetId: sid(ES), dimension: "ROWS", startIndex: 4 + b * 5 + r, endIndex: 5 + b * 5 + r }, properties: { pixelSize: px }, fields: "pixelSize" } });
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: cardReqs } });
  await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data: cardVals } });

  console.log(`Template dibuat: ${file.url}`);
  console.log(`Isi di .env.local: REPORT_TEMPLATE_WEBSITE=${id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 2: Jalankan (setelah Prasyarat 1–2)**

Run: `npx tsx scripts/report-template-website.ts --from=18g9R_AadxFlWlCnp6i0Ba27qq_s8I-DVsimEdH6G6GM`
Expected: `Template dibuat: https://docs.google.com/…` dan baris `REPORT_TEMPLATE_WEBSITE=…`.

- [ ] **Step 3: Verifikasi file user tidak berubah**

Run (pakai Drive MCP / browser): buka file `18g9R_…` — `modifiedTime` tetap `2026-10-19T11:23:23Z` dan isinya sama.

- [ ] **Step 4: Review visual bersama user**

Buka URL template di browser, screenshot tiap sheet, periksa: kartu KPI 4×3 rapi, penanda di tempat yang benar,
format angka, gridlines hilang, header beku. Perbaiki koordinat di script bila ada yang meleset — **hapus template
yang salah** (file milik app) dan jalankan ulang. Minta persetujuan user atas template sebelum Task 9.

- [ ] **Step 5: Simpan env & commit**

Tambahkan ke `.env.local` (user): `REPORT_TEMPLATE_WEBSITE=<id>`. Tambahkan ke `.env.example`:

```
# Laporan bulanan (Google Sheets) — ID file master template per channel
REPORT_TEMPLATE_WEBSITE=
# Opsional: folder Drive tujuan laporan (default: folder template)
REPORT_FOLDER_ID=
```

```bash
git add scripts/report-template-website.ts .env.example
git commit -m "Script master template laporan Website (salinan baru, rapih + penanda + kartu KPI)"
```

---

### Task 9: Orkestrasi `generateReport`

**Files:**
- Create: `lib/reports/engine/generate.ts`

- [ ] **Step 1: Implementasi**

```ts
// Generate laporan: salin master template → isi → catat. Laporan lama (buatan app) diberi akhiran "(lama …)".
import { prisma } from "../../db";
import { reportChannel } from "../channels";
import { monthTitle } from "../channels/website";
import { planFill } from "./tokens";
import { applyPlan, copyFile, readGrids, renameFile, ReportError, reportClients } from "./sheets";

export const reportName = (title: string, month: string) => `MKK ${title} Monthly Performance Report – ${monthTitle(month)}`;
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export function templateId(channelId: string): string | null {
  const ch = reportChannel(channelId);
  return (ch && process.env[ch.templateEnv]?.trim()) || null;
}

export async function generateReport(channelId: string, month: string, trigger: "manual" | "cron" = "manual") {
  const ch = reportChannel(channelId);
  let fileId: string | null = null;
  let url: string | null = null;
  try {
    if (!ch) throw new ReportError(`Laporan "${channelId}" belum tersedia.`);
    const tpl = templateId(ch.id);
    if (!tpl) throw new ReportError(`${ch.templateEnv} belum diisi di .env.local (ID file master template).`);
    const c = await reportClients();
    const data = await ch.build(month);
    const previous = await prisma.generatedReport.findMany({ where: { channel: ch.id, month, status: "success", fileId: { not: null } } });
    const file = await copyFile(c, tpl, reportName(ch.title, month), process.env.REPORT_FOLDER_ID?.trim() || undefined);
    fileId = file.id;
    url = file.url;
    const grids = await readGrids(c, file.id);
    const plan = planFill(grids, data);
    await applyPlan(c, file.id, plan, grids);
    for (const p of previous) await renameFile(c, p.fileId!, `${reportName(ch.title, month)} (lama ${today()})`).catch(() => undefined);
    return prisma.generatedReport.create({
      data: { channel: ch.id, month, fileId, url, status: "success", trigger, warnings: plan.warnings.length ? plan.warnings.join("\n") : null },
    });
  } catch (e) {
    const error = e instanceof ReportError ? e.message : `Gagal membuat laporan: ${(e as Error)?.message ?? e}`;
    if (fileId && ch) {
      try {
        await renameFile(await reportClients(), fileId, `${reportName(ch.title, month)} (GAGAL ${today()})`);
      } catch {
        /* abaikan */
      }
    }
    return prisma.generatedReport.create({ data: { channel: channelId, month, fileId, url, status: "error", trigger, error } });
  }
}
```

- [ ] **Step 2: Uji end-to-end September (setelah Task 8 disetujui)**

Buat `scripts/_gen.ts` sementara:

```ts
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
(async () => {
  const { generateReport } = await import("@/lib/reports/engine/generate");
  console.log(await generateReport("website", "2026-09"));
})();
```

Run: `npx tsx scripts/_gen.ts && rm scripts/_gen.ts`
Expected: record `status: 'success'`, `url` laporan, `warnings: null`.
Buka URL: bandingkan dengan laporan September user — KPI 835 / 773 / 1,839 / 7,203, tabel channel 7 baris,
GSC harian 30 baris, query & halaman terisi, temuan berbahasa Inggris, kartu KPI berwarna.

- [ ] **Step 3: Commit**

```bash
git add lib/reports/engine/generate.ts
git commit -m "generateReport: salin template, isi, catat; laporan lama/gagal diberi akhiran"
```

---

### Task 10: API + tombol di halaman Report

**Files:**
- Create: `app/api/reports/generate/route.ts`
- Create: `components/report/ReportGenerator.tsx`
- Modify: `app/report/page.tsx` (tambah section di atas, sebelum isi laporan; disembunyikan saat cetak)

- [ ] **Step 1: Route**

`app/api/reports/generate/route.ts`:

```ts
// POST /api/reports/generate — { channel: "website", month: "YYYY-MM" } → buat laporan Google Sheets.
import { generateReport } from "@/lib/reports/engine/generate";
import { isMonth } from "@/lib/month";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { channel?: string; month?: string };
  if (!body.channel || !body.month || !isMonth(body.month)) return Response.json({ error: "channel & month (YYYY-MM) wajib." }, { status: 400 });
  const r = await generateReport(body.channel, body.month, "manual");
  return Response.json(r, { status: r.status === "success" ? 200 : 500 });
}
```

- [ ] **Step 2: Komponen**

`components/report/ReportGenerator.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReportRow {
  channel: string;
  title: string;
  configured: boolean;
  latest: { url: string | null; status: string; createdAt: string; error: string | null; warnings: string | null } | null;
}

export function ReportGenerator({ month, locked, rows }: { month: string; locked: boolean; rows: ReportRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (channel: string) => {
    setBusy(channel);
    await fetch("/api/reports/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel, month }) });
    setBusy(null);
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-2 print:hidden">
      {!locked && <p className="text-xs text-warning">Bulan ini belum dikunci — angka di laporan masih bisa berubah jika data di-sync ulang.</p>}
      {rows.map((r) => (
        <div key={r.channel} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <div>
            <p className="font-medium">Laporan {r.title}</p>
            <p className="text-xs text-muted-foreground">
              {!r.configured
                ? "Master template belum dikonfigurasi."
                : r.latest
                  ? r.latest.status === "success"
                    ? `Terakhir dibuat ${new Date(r.latest.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })}${r.latest.warnings ? " · ada peringatan" : ""}`
                    : `Gagal: ${r.latest.error}`
                  : "Belum pernah dibuat untuk bulan ini."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {r.latest?.status === "success" && r.latest.url && (
              <Button variant="ghost" size="sm" asChild>
                <a href={r.latest.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Buka
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={!r.configured || busy != null} onClick={() => run(r.channel)}>
              {busy === r.channel ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Buat laporan Google Sheets
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Pasang di halaman Report**

Di `app/report/page.tsx`, di dalam komponen halaman setelah `month` diketahui, ambil data:

```tsx
  const [generated, lock] = await Promise.all([
    prisma.generatedReport.findMany({ where: { month }, orderBy: { createdAt: "desc" } }),
    prisma.monthLock.findUnique({ where: { month } }),
  ]);
  const reportRows: ReportRow[] = REPORT_CHANNELS.map((ch) => {
    const latest = generated.find((g) => g.channel === ch.id);
    return {
      channel: ch.id,
      title: ch.title,
      configured: !!templateId(ch.id),
      latest: latest ? { url: latest.url, status: latest.status, createdAt: latest.createdAt.toISOString(), error: latest.error, warnings: latest.warnings } : null,
    };
  });
```

dan render tepat setelah header laporan:

```tsx
      <section className="print:hidden">
        <h2 className="mb-2 text-sm font-medium">Laporan Google Sheets</h2>
        <ReportGenerator month={month} locked={!!lock} rows={reportRows} />
      </section>
```

Import: `prisma` dari `@/lib/db`, `REPORT_CHANNELS` dari `@/lib/reports/channels`, `templateId` dari `@/lib/reports/engine/generate`, `ReportGenerator, type ReportRow` dari `@/components/report/ReportGenerator`.

- [ ] **Step 4: Typecheck, lint, cek browser**

Run: `npx tsc --noEmit -p . && npx eslint app/report app/api/reports components/report`
Expected: tanpa output. Buka `http://localhost:3000/report?m=2026-09`: baris "Laporan Website" + tombol; klik → link "Buka" muncul.

- [ ] **Step 5: Commit**

```bash
git add app/api/reports components/report app/report/page.tsx
git commit -m "Halaman Report: tombol buat laporan Google Sheets + riwayat"
```

---

### Task 11: Cron membuat laporan setelah bulan dikunci

**Files:**
- Modify: `lib/connectors/cron.ts` (blok setelah `setMonthLock(month, true, …)`)

- [ ] **Step 1: Tambah pemanggilan**

Ganti blok:

```ts
    if (!locked && metricResults.length && metricResults.every((r) => r.ok)) {
      await setMonthLock(month, true, "Otomatis setelah sync cron");
      console.log(`[sync-cron] 🔒 ${month} dikunci`);
    }
```

dengan:

```ts
    if (!locked && metricResults.length && metricResults.every((r) => r.ok)) {
      await setMonthLock(month, true, "Otomatis setelah sync cron");
      console.log(`[sync-cron] 🔒 ${month} dikunci`);
      // bulan final → buat laporan Google Sheets untuk channel yang template-nya sudah ada
      const { REPORT_CHANNELS } = await import("../reports/channels");
      const { generateReport, templateId } = await import("../reports/engine/generate");
      for (const ch of REPORT_CHANNELS.filter((c) => templateId(c.id))) {
        const r = await generateReport(ch.id, month, "cron");
        console.log(`[sync-cron] Laporan ${ch.title} ${month}: ${r.status === "success" ? r.url : r.error}`);
      }
    }
```

- [ ] **Step 2: Typecheck + semua tes**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: tanpa error; semua tes lolos.

- [ ] **Step 3: Commit**

```bash
git add lib/connectors/cron.ts
git commit -m "Cron: buat laporan Google Sheets setelah bulan dikunci"
```

---

### Task 12: Dokumentasi

**Files:**
- Modify: `README.md` (bagian baru setelah "Setup Connector")

- [ ] **Step 1: Tambah bagian README**

```markdown
## Laporan bulanan Google Sheets

Dashboard membuat laporan untuk client sebagai **file Google Sheets baru** dari master template per channel
(tahap 1: Website). File laporan/template buatan user tidak pernah diubah — app hanya bisa menulis ke file yang
dibuatnya sendiri (scope `drive.file`).

1. Aktifkan Google Sheets API di project OAuth client, lalu hubungkan ulang akun Google di kartu Google Sheets.
2. Buat master template sekali: `npx tsx scripts/report-template-website.ts --from=<ID laporan contoh>` →
   isi `REPORT_TEMPLATE_WEBSITE=<id>` di `.env.local`. Template bebas diedit (warna, posisi) selama penanda
   `{{…}}` tetap ada; `{{#tabel.kolom}}` = baris tabel yang digandakan otomatis.
3. Halaman **Report** → "Buat laporan Google Sheets". Cron membuat laporan otomatis tgl 3 setelah bulan dikunci.
   Laporan lama bulan yang sama diberi akhiran "(lama …)".
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "README: laporan bulanan Google Sheets"
```

---

## Self-review (dicatat penulis rencana)

- Cakupan spec: mesin murni (T3), Google layer (T7), template file baru & rapih (T8), kartu KPI satu sumber (T4),
  narasi template kalimat (T5), tombol + riwayat (T10), cron setelah kunci (T11), scope `drive.file` (T1),
  `GeneratedReport` (T2), file user tak diubah (T7 komentar + T8 Step 3), laporan lama di-rename (T9).
- Penyimpangan dari spec: warna kartu KPI ditulis langsung (repeatCell) saat generate, bukan conditional formatting —
  arah "bagus" tidak selalu = panah (bounce rate turun = hijau), jadi warna ditentukan mesin. Pengaturan cetak
  A4 landscape tidak tersedia di Sheets API — dicatat di README template bila diperlukan (diatur manual sekali di template).
- Chart: laporan Website tidak punya chart (dicek 19 Okt) — penanganan rentang chart masuk tahap channel lain.
