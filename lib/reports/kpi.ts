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

/** Perubahan vs bulan lalu dalam bahasa Inggris + tone warna (aturan sama dengan DeltaBadge dashboard). */
export function kpiChange(kind: KpiKind, cur: number | null | undefined, prev: number | null | undefined, goodWhenUp = true): { text: string; tone: Tone } {
  if (cur == null || prev == null || (kind !== "rate" && prev === 0)) return { text: "No data last month", tone: "none" };
  const diff = cur - prev;
  const flat = kind === "rate" ? Math.abs(diff) < 0.0005 : Math.abs(diff / prev) < 0.0005;
  if (flat) return { text: `→ ${kind === "rate" ? "0.0 percentage points" : "0.0%"} vs last month`, tone: "flat" };
  const sign = diff > 0 ? "+" : MINUS;
  // laporan client: "percentage points" ditulis lengkap (bukan "pp") supaya tidak membingungkan
  const body = kind === "rate" ? `${sign}${en1(diff * 100)} percentage points` : `${sign}${en1((diff / prev) * 100)}%`;
  const good = diff > 0 === goodWhenUp;
  // metrik "turun = bagus" (bounce rate, posisi): panah = arah angka, kata = maknanya, supaya ↓ hijau tidak membingungkan
  const meaning = goodWhenUp ? "" : good ? " (better)" : " (worse)";
  return { text: `${diff > 0 ? "↑" : "↓"} ${body} vs last month${meaning}`, tone: good ? "good" : "bad" };
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

/** Field summary Website yang dipakai kartu KPI. */
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

/** Kartu KPI Website (urutan = grid dashboard & blok kartu laporan). */
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
