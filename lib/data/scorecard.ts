// Team Scorecard: enam ukuran kerja divisi per bulan. Hanya sambungan yang dihitung (confirmed / Story code /
// Task Progress / auto) yang dipakai — saran tidak pernah menaikkan angka. Bulan yang dikunci disimpan sebagai
// snapshot (TeamScore) supaya tidak berubah lagi; bulan lain dihitung live.
import { prisma } from "../db";
import { daysInMonth, lastMonths } from "../month";
import { articleKey } from "../team/store";
import { assetSummary, ASSETS, type AssetCell, type AssetKey, type AssetState } from "../team/contributors";
import { contentQuota, getMonthBundle } from "./summary";
import { derivativesByArticle } from "./pipeline";
import { dayDiff, loadBriefs, median } from "./team";

export type ScoreKey = "repurpose" | "articleToIg" | "briefToPost" | "backlog" | "assets" | "quota";

export interface ScoreDef {
  key: ScoreKey;
  label: string;
  unit: "%" | "days" | "briefs";
  /** usulan awal — dibahas dengan Content & Creative Manager */
  target: number;
  better: "higher" | "lower";
  description: string;
}

export const SCORE_DEFS: ScoreDef[] = [
  { key: "repurpose", label: "Repurpose rate", unit: "%", target: 80, better: "higher", description: "Articles published this month that have at least one Instagram derivative (feed, reel, or IG story)." },
  { key: "articleToIg", label: "Article → derivative", unit: "days", target: 7, better: "lower", description: "Median days from article to its first Instagram derivative. Teasers posted before the article are left out." },
  { key: "briefToPost", label: "Brief → posted", unit: "days", target: 3, better: "lower", description: "Median days from a brief (dated this month) to its Instagram post." },
  { key: "backlog", label: "Brief backlog", unit: "briefs", target: 3, better: "lower", description: "Briefs from the last 45 days still not posted at month end (Unpublished / Rejected in Task Progress excluded)." },
  { key: "assets", label: "Complete assets", unit: "%", target: 70, better: "higher", description: "Local contributor stories with a photo, portrait video, and interview video all available." },
  { key: "quota", label: "Content quota", unit: "%", target: 100, better: "higher", description: "Average achievement of the News, Social, and YouTube quotas (each capped at 100%)." },
];

export interface Score {
  key: ScoreKey;
  value: number | null;
  detail: string;
  /** pembilang / penyebut untuk ukuran rasio */
  n?: number | null;
  base?: number | null;
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

/** Hitung keenam ukuran untuk satu bulan dari data saat ini. */
export async function computeScorecard(month: string): Promise<Score[]> {
  const days = daysInMonth(month);
  const end = [days.at(-1)!, today()].sort()[0];

  // artikel tayang bulan ini (satu per artikel — baris "in review" tambahan tidak dihitung)
  const articles = await prisma.newsArticle.findMany({ where: { month, status: "publish", import: { source: "news_log" }, date: { not: null } }, select: { title: true, url: true, date: true } });
  const articleDates = new Map(articles.map((a) => [articleKey(a), a.date!]));
  const derivs = await derivativesByArticle(articleDates);
  const repurposed = [...derivs].filter(([, d]) => d.derivs.length);
  const lags = repurposed.flatMap(([k, d]) => {
    const first = d.derivs.filter((x) => !x.teaser).sort((a, b) => a.date.localeCompare(b.date))[0];
    const lag = first ? dayDiff(articleDates.get(k)!, first.date) : null;
    return lag != null && lag >= 0 ? [lag] : [];
  });

  // brief: dibuat bulan ini (lama tayang) & 45 hari terakhir sebelum akhir bulan (backlog)
  const since = new Date(Date.parse(`${end}T00:00:00Z`) - 45 * 864e5).toISOString().slice(0, 10);
  const briefs = (await loadBriefs({})).filter((b) => b.date <= end && b.date >= since);
  const ofMonth = briefs.filter((b) => b.month === month);
  const briefLags = ofMonth.flatMap((b) => (b.postedOn && b.postedOn <= end && b.lag != null && b.lag >= 0 ? [b.lag] : []));
  // Published di Task Progress tanpa tanggal: sudah tayang, kapan tidak diketahui → tidak dihitung backlog
  const backlog = briefs.filter((b) => b.task?.stage !== "stopped" && !(b.state === "posted" && !b.postedOn) && (!b.postedOn || b.postedOn > end));

  // aset kontributor (tab bulan ini)
  const tasks = await prisma.contributorTask.findMany({ where: { tab: month } });
  const complete = tasks.filter((t) => assetSummary(Object.fromEntries(ASSETS.map((a) => [a.key, { state: t[a.key] as AssetState, by: null, at: null }])) as Record<AssetKey, AssetCell>).complete).length;

  // kuota konten (sudah ada di dashboard)
  const bundle = await getMonthBundle(month);
  const quotas = (["news", "social", "youtube"] as const).map((ch) => contentQuota(bundle, ch)).filter((q) => q.available && q.rate != null);
  const quotaAvg = quotas.length ? Math.round((quotas.reduce((s, q) => s + Math.min(1, q.rate!), 0) / quotas.length) * 1000) / 10 : null;

  const repurposeLag = median(lags);
  const briefLag = median(briefLags);
  return [
    { key: "repurpose", value: pct(repurposed.length, articles.length), n: repurposed.length, base: articles.length, detail: `${repurposed.length} of ${articles.length} articles` },
    { key: "articleToIg", value: repurposeLag, detail: lags.length ? `median of ${lags.length} articles` : "no repurposed article yet" },
    { key: "briefToPost", value: briefLag, detail: `${briefLags.length} of ${ofMonth.length} briefs posted` },
    { key: "backlog", value: backlog.length, detail: backlog.length ? backlog.slice(0, 3).map((b) => b.topic || b.task?.article || b.fileName).join(", ") + (backlog.length > 3 ? ", …" : "") : "none" },
    { key: "assets", value: tasks.length ? pct(complete, tasks.length) : null, n: complete, base: tasks.length, detail: tasks.length ? `${complete} of ${tasks.length} stories` : "contributor tab not filled in yet" },
    { key: "quota", value: quotaAvg, detail: quotas.map((q) => `${q.label} ${Math.round(q.rate! * 100)}%`).join(" · ") || "no quota data" },
  ];
}

/** Snapshot (bulan terkunci) atau hitungan live. */
export async function getScorecard(month: string): Promise<{ scores: Score[]; frozenAt: Date | null }> {
  const snap = await prisma.teamScore.findMany({ where: { month } });
  if (snap.length) return { scores: SCORE_DEFS.map((d) => snap.find((s) => s.key === d.key)).filter((s) => !!s).map((s) => ({ key: s.key as ScoreKey, value: s.value, n: s.n, base: s.base, detail: s.detail ?? "" })), frozenAt: snap[0].createdAt };
  return { scores: await computeScorecard(month), frozenAt: null };
}

/** Riwayat beberapa bulan terakhir (sejak data tim tersedia). */
export async function scorecardHistory(month: string, n = 6, from = "2026-07") {
  const months = lastMonths(month, n).filter((m) => m >= from);
  return Promise.all(months.map(async (m) => ({ month: m, ...(await getScorecard(m)) })));
}

/** Dipanggil saat bulan dikunci: simpan angka saat itu. Buka kunci → hapus, kembali live. */
export async function snapshotScorecard(month: string): Promise<void> {
  const scores = await computeScorecard(month);
  await prisma.$transaction([prisma.teamScore.deleteMany({ where: { month } }), prisma.teamScore.createMany({ data: scores.map((s) => ({ month, ...s })) })]);
}

export async function clearScorecard(month: string): Promise<void> {
  await prisma.teamScore.deleteMany({ where: { month } });
}

/** Status terhadap target usulan. */
export function onTarget(def: ScoreDef, value: number | null): boolean | null {
  if (value == null) return null;
  return def.better === "higher" ? value >= def.target : value <= def.target;
}
