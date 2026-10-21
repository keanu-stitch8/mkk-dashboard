// Format angka/teks untuk UI: teks English, angka & tanggal gaya Indonesia (locale en-ID): 1.353 · 88,3% · 9 Sept 2026 · 1m 44s.

const nf0 = new Intl.NumberFormat("en-ID", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-ID", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-ID", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-ID", { notation: "compact", maximumFractionDigits: 1 });

export const DASH = "—";

export function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return (digits === 0 ? nf0 : digits === 1 ? nf1 : nf2).format(v);
}

export function fmtCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return Math.abs(v) < 10000 ? nf0.format(v) : compact.format(v);
}

/** Pecahan 0–1 → "88,3%". */
export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return `${new Intl.NumberFormat("en-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v * 100)}%`;
}

/** Detik → "1m 44s" / "45s" / "1h 2m". */
export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return DASH;
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const d = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(d).padStart(2, "0")}s`;
  return `${d}s`;
}

const dateFmt = new Intl.DateTimeFormat("en-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-ID", { day: "numeric", month: "short", timeZone: "UTC" });

export function fmtDate(d: string | null | undefined, withYear = true): string {
  if (!d) return DASH;
  const date = new Date(d.slice(0, 10) + "T00:00:00Z");
  if (isNaN(date.getTime())) return d;
  return (withYear ? dateFmt : dayFmt).format(date);
}

export interface Delta {
  abs: number;
  pct: number | null;
}

export function delta(cur: number | null | undefined, prev: number | null | undefined): Delta | null {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  return { abs: cur - prev, pct: prev === 0 ? null : (cur - prev) / Math.abs(prev) };
}

/** "+12,5%" / "−3,1%" */
export function fmtDeltaPct(d: Delta | null): string {
  if (!d) return DASH;
  if (d.pct == null) return d.abs === 0 ? "0%" : "new";
  const v = d.pct * 100;
  const s = new Intl.NumberFormat("en-ID", { maximumFractionDigits: 1 }).format(Math.abs(v));
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s}%`;
}

/** Selisih poin persentase untuk metrik rasio: "+2,3 pp". */
export function fmtDeltaPp(cur: number | null | undefined, prev: number | null | undefined): string {
  if (cur == null || prev == null) return DASH;
  const v = (cur - prev) * 100;
  const s = new Intl.NumberFormat("en-ID", { maximumFractionDigits: 1 }).format(Math.abs(v));
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s} pp`;
}

export function truncate(s: string | null | undefined, n = 60): string {
  if (!s) return "";
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1) + "…" : one;
}
