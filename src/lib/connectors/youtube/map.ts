// Mapping YouTube Data API + Analytics API + Reporting API (Reach) → Dataset yang sama dengan import CSV YouTube Studio.
// Murni (tanpa I/O) supaya bisa dites dengan fixture.
import Papa from "papaparse";
import type { Dataset } from "../../parsers/types";
import { parseDate, parseRate } from "../../parsers/values";
import { apiDataset, num } from "../common";
import { WIB, dateIn } from "../../tz";

/** "PT1H2M3S" → 3723 detik. */
export function isoDuration(iso: string | null | undefined): number | null {
  const m = String(iso ?? "").match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

/** Tanggal publish (UTC dari API) → tanggal WIB, konsisten dengan laporan lain. */
export const wibDate = (iso: string) => dateIn(iso, WIB);

/** Respons youtubeAnalytics.reports.query. */
export interface AnalyticsResponse {
  columnHeaders?: { name?: string | null }[] | null;
  rows?: (string | number)[][] | null;
}

export function analyticsRows(res: AnalyticsResponse): Record<string, string | number>[] {
  const cols = (res.columnHeaders ?? []).map((c) => c.name ?? "");
  return (res.rows ?? []).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}

export interface VideoMeta {
  id: string;
  title: string;
  publishedAt: string; // ISO UTC
  durationSec: number | null;
  /** status.privacyStatus: public | unlisted | private (kosong = tidak diketahui) */
  privacy?: string | null;
}

/**
 * Hanya video public yang masuk laporan. Re-upload membuat video lama jadi private/unlisted (atau dihapus — video
 * terhapus sudah tidak dikembalikan videos.list), jadi tanpa filter ini video yang sama terhitung dua kali.
 * Status tidak diketahui tetap dihitung supaya tidak ada video yang hilang diam-diam.
 */
export function splitByPrivacy(videos: VideoMeta[]): { listed: VideoMeta[]; hidden: VideoMeta[] } {
  const listed: VideoMeta[] = [];
  const hidden: VideoMeta[] = [];
  for (const v of videos) (v.privacy == null || v.privacy === "public" ? listed : hidden).push(v);
  return { listed, hidden };
}

export interface ReachRow {
  date: string;
  videoId: string;
  impressions: number;
  ctr: number;
}

/** CSV laporan channel_reach_basic_a1 → baris harian per video. */
export function parseReachCsv(text: string): ReachRow[] {
  const { data } = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  return data
    .map((r) => ({
      date: parseDate(r.date)?.date ?? "",
      videoId: (r.video_id ?? "").trim(),
      impressions: num(r.video_thumbnail_impressions),
      ctr: parseRate(r.video_thumbnail_impressions_ctr, "auto") ?? 0,
    }))
    .filter((r) => r.date && r.videoId);
}

/** Impressions per video (jumlah) dan CTR tertimbang impressions. */
export function aggregateReach(rows: ReachRow[]): Map<string, { impressions: number; ctr: number | null }> {
  const acc = new Map<string, { impressions: number; clicks: number }>();
  for (const r of rows) {
    const a = acc.get(r.videoId) ?? { impressions: 0, clicks: 0 };
    a.impressions += r.impressions;
    a.clicks += r.impressions * r.ctr;
    acc.set(r.videoId, a);
  }
  return new Map([...acc].map(([id, a]) => [id, { impressions: a.impressions, ctr: a.impressions ? a.clicks / a.impressions : null }]));
}

export interface YoutubeMonthInput {
  /** video long-form yang dipublish di bulan ini (kohort laporan) */
  videos: VideoMeta[];
  perVideo: AnalyticsResponse;
  daily: AnalyticsResponse;
  /** impressions & CTR per video; null = tidak tersedia */
  reach: Map<string, { impressions: number; ctr: number | null }> | null;
  /**
   * Total kohort dari query agregat (filter video, tanpa dimensi). Dipakai untuk views, watch time, dan
   * average view duration total: sama persis dengan baris "Total" YouTube Studio. Average view duration
   * total YouTube ≠ watch time ÷ views, dan menjumlah menit per video kehilangan pembulatan.
   */
  totals?: AnalyticsResponse;
  /** unique viewers dari import sebelumnya (tidak ada di API) — lihat keepUniqueViewers */
  uniqueViewers?: { perVideo: Map<string, number>; total: number | null };
}

/**
 * Unique viewers dari import CSV sebelumnya. Per video dipakai jika videonya sama; total kohort hanya dipakai
 * jika daftar video persis sama dengan import itu (unique viewers tidak bisa dijumlah per video).
 */
export function keepUniqueViewers(
  videoIds: string[],
  prev: { videoId: string; uniqueViewers: number | null }[],
  prevTotal: number | null,
): { perVideo: Map<string, number>; total: number | null } {
  const perVideo = new Map(prev.filter((p) => p.uniqueViewers != null && videoIds.includes(p.videoId)).map((p) => [p.videoId, p.uniqueViewers!]));
  const sameSet = prev.length === videoIds.length && videoIds.every((id) => prev.some((p) => p.videoId === id));
  return { perVideo, total: sameSet && prevTotal != null ? prevTotal : null };
}

export function mapYoutubeMonth(input: YoutubeMonthInput, month: string, source: string): Dataset[] {
  const stats = new Map(analyticsRows(input.perVideo).map((r) => [String(r.video), r]));
  const rows = input.videos.map((v) => {
    const s = stats.get(v.id) ?? {};
    const views = num(s.views);
    const minutes = num(s.estimatedMinutesWatched);
    const reach = input.reach?.get(v.id);
    return {
      videoId: v.id,
      title: v.title,
      publishedDate: wibDate(v.publishedAt),
      durationSec: v.durationSec,
      views,
      watchHours: minutes / 60,
      avgViewDurationSec: views ? num(s.averageViewDuration) : null,
      impressions: input.reach ? (reach?.impressions ?? 0) : null,
      ctr: input.reach ? (reach?.ctr ?? null) : null,
      uniqueViewers: input.uniqueViewers?.perVideo.get(v.id) ?? null,
      subsGained: num(s.subscribersGained),
      subsLost: num(s.subscribersLost),
      likes: num(s.likes),
      comments: num(s.comments),
      shares: num(s.shares),
    };
  });

  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((a, r) => a + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
  const total = input.totals ? analyticsRows(input.totals)[0] : undefined;
  const views = total ? num(total.views) : sum("views");
  const watchHours = total ? num(total.estimatedMinutesWatched) / 60 : sum("watchHours");
  const metrics: Dataset["metrics"] = [
    { channel: "youtube", key: "views", value: views },
    { channel: "youtube", key: "watchHours", value: watchHours },
    { channel: "youtube", key: "subsGained", value: sum("subsGained") },
    { channel: "youtube", key: "subsLost", value: sum("subsLost") },
  ];
  if (views) metrics.push({ channel: "youtube", key: "avgViewDurationSec", value: total?.averageViewDuration != null ? num(total.averageViewDuration) : (watchHours * 3600) / views });
  if (input.uniqueViewers?.total != null) metrics.push({ channel: "youtube", key: "uniqueViewers", value: input.uniqueViewers.total });
  if (input.reach) {
    const impressions = sum("impressions");
    metrics.push({ channel: "youtube", key: "impressions", value: impressions });
    if (impressions) metrics.push({ channel: "youtube", key: "ctr", value: rows.reduce((a, r) => a + (r.impressions ?? 0) * (r.ctr ?? 0), 0) / impressions });
  }

  const daily = analyticsRows(input.daily)
    .map((r) => ({ date: String(r.day), watchHours: num(r.estimatedMinutesWatched) / 60, views: num(r.views), _date: String(r.day) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return [
    apiDataset("yt_table", source, month, { rows, metrics }),
    apiDataset("yt_daily", source, month, { rows: daily, rowDated: true, priority: 2 }),
  ];
}
