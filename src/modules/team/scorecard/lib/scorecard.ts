import { ASSETS, assetSummary, type AssetCell, type AssetKey, type AssetState } from "@/lib/team/contributors";
import { daysInMonth } from "@/lib/month";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import type { ArticleDerivatives } from "../../pipeline/types/pipeline";
import { dayDiff, median } from "../../shared/lib/team-links";
import type { BriefRow } from "../../shared/types/team";
import type { Score, ScoreDef, ScoreKey } from "../types/scorecard";

// Team Scorecard: enam ukuran kerja divisi per bulan. Hanya sambungan yang dihitung (confirmed / Story code /
// Task Progress / auto) yang dipakai — saran tidak pernah menaikkan angka.

export const SCORE_DEFS: ScoreDef[] = [
  { key: "repurpose", label: "Repurpose rate", unit: "%", target: 80, better: "higher", description: "Articles published this month that have at least one Instagram derivative (feed, reel, or IG story)." },
  { key: "articleToIg", label: "Article → derivative", unit: "days", target: 7, better: "lower", description: "Median days from article to its first Instagram derivative. Teasers posted before the article are left out." },
  { key: "briefToPost", label: "Brief → posted", unit: "days", target: 3, better: "lower", description: "Median days from a brief (dated this month) to its Instagram post." },
  { key: "backlog", label: "Brief backlog", unit: "briefs", target: 3, better: "lower", description: "Briefs from the last 45 days still not posted at month end (Unpublished / Rejected in Task Progress excluded)." },
  { key: "assets", label: "Complete assets", unit: "%", target: 70, better: "higher", description: "Local contributor stories with a photo, portrait video, and interview video all available." },
  { key: "quota", label: "Content quota", unit: "%", target: 100, better: "higher", description: "Average achievement of the News, Social, and YouTube quotas (each capped at 100%)." },
];

/** Data tim (panduan, brief, Task Progress) tersedia sejak bulan ini; sebelumnya tidak ada scorecard. */
export const SCORECARD_FROM = "2026-07";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

/** Akhir periode ukur: akhir bulan, atau hari ini jika bulan masih berjalan. */
export const scorecardEnd = (month: string, today: string) => [daysInMonth(month).at(-1)!, today].sort()[0];

/** Brief dari 45 hari terakhir sebelum akhir periode (dasar backlog). */
export const backlogSince = (end: string) => new Date(Date.parse(`${end}T00:00:00Z`) - 45 * 864e5).toISOString().slice(0, 10);

export interface ScorecardInput {
  month: string;
  end: string;
  /** jumlah baris artikel tayang bulan ini (penyebut repurpose rate) */
  articleCount: number;
  /** kunci artikel → tanggal tayang */
  articleDates: Map<string, string>;
  derivs: Map<string, ArticleDerivatives>;
  /** brief dalam jendela backlog (45 hari s/d akhir periode) */
  briefs: BriefRow[];
  /** status 4 aset per rencana liputan kontributor (tab bulan ini) */
  assetStates: Record<AssetKey, AssetState>[];
  quotas: QuotaSummary[];
}

/** Keenam ukuran dari data yang sudah dimuat. */
export function buildScores({ month, end, articleCount, articleDates, derivs, briefs, assetStates, quotas }: ScorecardInput): Score[] {
  const repurposed = [...derivs].filter(([, d]) => d.derivs.length);
  const lags = repurposed.flatMap(([k, d]) => {
    const first = d.derivs.filter((x) => !x.teaser).sort((a, b) => a.date.localeCompare(b.date))[0];
    const lag = first ? dayDiff(articleDates.get(k)!, first.date) : null;
    return lag != null && lag >= 0 ? [lag] : [];
  });

  const ofMonth = briefs.filter((b) => b.month === month);
  const briefLags = ofMonth.flatMap((b) => (b.postedOn && b.postedOn <= end && b.lag != null && b.lag >= 0 ? [b.lag] : []));
  // Published di Task Progress tanpa tanggal: sudah tayang, kapan tidak diketahui → tidak dihitung backlog
  const backlog = briefs.filter((b) => b.task?.stage !== "stopped" && !(b.state === "posted" && !b.postedOn) && (!b.postedOn || b.postedOn > end));

  const complete = assetStates.filter((t) => assetSummary(Object.fromEntries(ASSETS.map((a) => [a.key, { state: t[a.key], by: null, at: null }])) as Record<AssetKey, AssetCell>).complete).length;

  const rated = quotas.filter((q) => q.available && q.rate != null);
  const quotaAvg = rated.length ? Math.round((rated.reduce((s, q) => s + Math.min(1, q.rate!), 0) / rated.length) * 1000) / 10 : null;

  const articles = articleCount;
  const repurposeLag = median(lags);
  const briefLag = median(briefLags);
  return [
    { key: "repurpose", value: pct(repurposed.length, articles), n: repurposed.length, base: articles, detail: `${repurposed.length} of ${articles} articles` },
    { key: "articleToIg", value: repurposeLag, detail: lags.length ? `median of ${lags.length} articles` : "no repurposed article yet" },
    { key: "briefToPost", value: briefLag, detail: `${briefLags.length} of ${ofMonth.length} briefs posted` },
    { key: "backlog", value: backlog.length, detail: backlog.length ? backlog.slice(0, 3).map((b) => b.topic || b.task?.article || b.fileName).join(", ") + (backlog.length > 3 ? ", …" : "") : "none" },
    { key: "assets", value: assetStates.length ? pct(complete, assetStates.length) : null, n: complete, base: assetStates.length, detail: assetStates.length ? `${complete} of ${assetStates.length} stories` : "contributor tab not filled in yet" },
    { key: "quota", value: quotaAvg, detail: rated.map((q) => `${q.label} ${Math.round(q.rate! * 100)}%`).join(" · ") || "no quota data" },
  ];
}

/** Snapshot tersimpan → Score, urut SCORE_DEFS. */
export function snapshotScores(rows: { key: string; value: number | null; n: number | null; base: number | null; detail: string | null }[]): Score[] {
  return SCORE_DEFS.map((d) => rows.find((s) => s.key === d.key))
    .filter((s) => !!s)
    .map((s) => ({ key: s.key as ScoreKey, value: s.value, n: s.n, base: s.base, detail: s.detail ?? "" }));
}

/** Status terhadap target usulan. */
export function onTarget(def: ScoreDef, value: number | null): boolean | null {
  if (value == null) return null;
  return def.better === "higher" ? value >= def.target : value <= def.target;
}
