// Data laporan YouTube: angka KPI dari summary dashboard (identik dengan dashboard) + daftar video dari Publishing Log
// digabung metrik video YouTube Analytics, + progres seri produksi (lib/reports/youtube-series.ts).
import { prisma } from "../../db";
import { getMonthAndPrev } from "../../data/summary";
import { daysInMonth, prevMonth } from "../../month";
import { fmtDurationEn, kpiData, YOUTUBE_KPIS } from "../kpi";
import { enMonth } from "../month";
import type { Cell, ReportChannel, ReportData } from "../types";
import { isRecap, seriesFor, seriesProgress } from "../youtube-series";
import { sheetDate } from "./news";
import { youtubeFindings } from "./youtube-narrative";

/**
 * Baris tetap tabel tipe & kategori di Executive Summary (rentang pie chart menunjuk baris-baris ini, jadi jumlahnya
 * tidak boleh berubah antar bulan). Daftar = Ref laporan YouTube user; kategori di luar daftar → "Other".
 */
export const YT_TYPES = ["Editorial Feature", "Recap", "Teaser"];
export const YT_CATEGORIES = ["Accommodation", "Attraction", "Club", "Community", "Culinary", "Event", "Hero", "Profile", "Sport Gears", "Venue"];
export const YT_CATEGORY_SLOTS = YT_CATEGORIES.length + 1; // + Other

const div = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : a / b);
const sumOf = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const norm = (s: string) => s.trim().toLowerCase();

/** Tipe konten laporan: judul "recap" → Recap; "Editorial Feature Video" = Editorial Feature; selain Teaser → Editorial Feature. */
export function videoType(title: string, format: string | null): string {
  if (isRecap(title) || norm(format ?? "") === "recap") return "Recap";
  if (norm(format ?? "") === "teaser") return "Teaser";
  return "Editorial Feature";
}

/** Hitung per kategori ke slot tetap; kategori tak dikenal / kosong masuk "Other". */
export function ytCategorySlots(categories: (string | null)[]): { name: string; count: number }[] {
  const slots = [...YT_CATEGORIES, "Other"].map((name) => ({ name, count: 0 }));
  for (const c of categories) {
    const i = YT_CATEGORIES.findIndex((k) => norm(k) === norm(c ?? ""));
    slots[i >= 0 ? i : slots.length - 1].count++;
  }
  return slots;
}

export async function buildYoutube(month: string): Promise<ReportData> {
  const prev = prevMonth(month);
  const { cur, prev: prevBundle } = await getMonthAndPrev(month);
  const y = cur.youtube;
  const p = prevBundle.youtube.hasData ? prevBundle.youtube : null;
  const kpi = kpiData(YOUTUBE_KPIS, y, p);
  const quota = y.quota.value;

  // daftar video = Publishing Log (status Publish); bulan tanpa log → video YouTube yang dipublish bulan itu
  const logs = y.logs.filter((l) => l.status === "publish");
  const metricOf = (videoId: string | null, title: string) => y.videos.find((v) => (videoId && v.videoId === videoId) || norm(v.title) === norm(title));
  const list = (
    logs.length
      ? logs.map((l) => ({ date: l.date, title: l.title, url: l.url, format: l.format, category: l.category, m: metricOf(l.videoId, l.title) }))
      : y.videos.filter((v) => v.publishedDate?.startsWith(month)).map((v) => ({ date: v.publishedDate, title: v.title, url: `https://www.youtube.com/watch?v=${v.videoId}`, format: v.format, category: v.category, m: v }))
  ).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const recaps = list.filter((v) => isRecap(v.title)).length;

  const series = seriesFor(month);
  const seriesLogs = series
    ? await prisma.ytLog.findMany({ where: { status: "publish", month: { gte: series.from, lte: month } }, select: { month: true, title: true } })
    : [];
  const prog = series ? seriesProgress(series, month, seriesLogs) : null;

  const typeRows = YT_TYPES.map((name) => ({ name, count: list.filter((v) => videoType(v.title, v.format) === name).length }));
  const cats = ytCategorySlots(list.map((v) => v.category));
  const unpublished = Math.max(quota - list.length, 0);
  const ranked = [...list].filter((v) => v.m?.views != null).sort((a, b) => b.m!.views - a.m!.views);
  const top = ranked[0];

  const days = daysInMonth(month).length;
  // bagian video yang ditonton rata-rata, tertimbang views (hanya video yang durasinya diketahui)
  const withLen = list.filter((v) => v.m?.durationSec && v.m.avgViewDurationSec != null && v.m.views);
  const watchedShare = withLen.length ? sumOf(withLen.map((v) => v.m!.views * (v.m!.avgViewDurationSec! / v.m!.durationSec!))) / sumOf(withLen.map((v) => v.m!.views)) : null;
  const topSubs = [...list].filter((v) => v.m?.subsGained).sort((a, b) => b.m!.subsGained! - a.m!.subsGained!)[0];
  const findings = youtubeFindings({
    monthLabel: enMonth(month),
    prevMonthLabel: enMonth(prev),
    quota,
    published: y.published,
    recaps,
    series: series && prog ? { name: series.name, produced: series.produced, publishedToDate: prog.before + prog.thisMonth, remaining: prog.remaining } : null,
    views: y.views,
    prevViews: p?.views ?? null,
    top: ranked.map((v) => ({ title: v.title, views: v.m!.views })),
    prevTop: p?.topVideos[0] ? { title: p.topVideos[0].title, views: p.topVideos[0].views } : null,
    late: list
      .filter((v) => v.date?.startsWith(month) && days - Number(v.date.slice(8, 10)) + 1 <= 7)
      .map((v) => ({ title: v.title, date: v.date!, days: days - Number(v.date!.slice(8, 10)) + 1 })),
    lowCtr: y.lowCtrVideos.map((v) => ({ title: v.title, ctr: v.ctr! })),
    watchedShare,
    avgViewDurationSec: y.avgViewDurationSec,
    subsGained: y.subsGained,
    topSubs: topSubs ? { title: topSubs.title, subs: topSubs.m!.subsGained! } : null,
  });

  const monthName = enMonth(month).split(" ")[0];
  const prevSeriesMonths = series && month > series.from ? `${enMonth(series.from).split(" ")[0].slice(0, 3)}–${enMonth(prev).split(" ")[0].slice(0, 3)}` : null;
  const values: Record<string, Cell> = {
    month_label: enMonth(month),
    month_upper: enMonth(month).toUpperCase(),
    month_name: monthName,
    year: Number(month.slice(0, 4)),
    prev_month_label: enMonth(prev),
    period: `1–${days} ${enMonth(month)}`,
    ...kpi.values,
    quota,
    published: y.published,
    achievement: y.achievement,
    // sama dengan QuotaHero dashboard: sisa = kuota − published
    remaining: Math.max(quota - y.published, 0),
    recaps,
    "top.title": top?.title ?? "—",
    "top.views": top?.m?.views ?? null,
    "top.share": top ? div(top.m!.views, y.views) : null,
    "series.name": series?.name ?? "No active series",
    "series.shoot": series?.shootPeriod ?? "—",
    "series.produced": series?.produced ?? null,
    "series.before_label": prevSeriesMonths ? `PUBLISHED ${prevSeriesMonths.toUpperCase()}` : "PUBLISHED EARLIER",
    "series.before": prog?.before ?? null,
    "series.month_label": `PUBLISHED IN ${monthName.toUpperCase()}`,
    "series.month": prog?.thisMonth ?? null,
    "series.remaining": prog?.remaining ?? null,
    "types.total": sumOf(typeRows.map((t) => t.count)),
    "cat.unpublished": unpublished,
    "cat.unpublished_share": div(unpublished, quota) ?? 0,
    "cat.quota": quota,
    "videos.total_views": y.views,
    "videos.total_unique": y.uniqueViewers,
    "videos.total_watch": y.watchHours,
    "videos.total_avd": y.avgViewDurationSec != null ? fmtDurationEn(y.avgViewDurationSec) : "—",
    "videos.total_impressions": y.impressions,
    "videos.total_ctr": y.ctr,
    "videos.total_subs": y.subsGained,
    listed: list.length,
  };
  const typeTotal = sumOf(typeRows.map((t) => t.count));
  typeRows.forEach((t, i) => {
    values[`type.${i + 1}.name`] = t.name;
    values[`type.${i + 1}.count`] = t.count;
    values[`type.${i + 1}.share`] = div(t.count, typeTotal) ?? 0;
  });
  cats.forEach((c, i) => {
    values[`cat.${i + 1}.name`] = c.name;
    values[`cat.${i + 1}.count`] = c.count;
    values[`cat.${i + 1}.share`] = div(c.count, quota) ?? 0;
  });

  return {
    values,
    tones: kpi.tones,
    autoHeight: ["findings", "videos", "log"],
    // kategori "Other" (slot terakhir) hanya tampil jika ada isinya
    hideRows: cats.at(-1)!.count === 0 ? [`cat.${cats.length}.name`] : [],
    tables: {
      findings: findings.map((text) => ({ text })),
      videos: list.map((v, i) => ({
        no: i + 1,
        date: sheetDate(v.date),
        title: v.title,
        type: videoType(v.title, v.format),
        category: v.category ?? "",
        views: v.m?.views ?? null,
        unique: v.m?.uniqueViewers ?? null,
        watch: v.m?.watchHours ?? null,
        avd: v.m?.avgViewDurationSec != null ? fmtDurationEn(v.m.avgViewDurationSec) : "—",
        impressions: v.m?.impressions ?? null,
        ctr: v.m?.ctr ?? null,
        subs: v.m?.subsGained ?? null,
        share: div(v.m?.views, y.views),
      })),
      log: list.map((v, i) => ({
        no: i + 1,
        date: sheetDate(v.date),
        title: v.title,
        url: v.url ?? "",
        type: videoType(v.title, v.format),
        category: v.category ?? "",
        production: isRecap(v.title) ? "Recap (separate production)" : series ? `${series.name} series` : "",
        status: "Published",
      })),
    },
  };
}

export const youtube: ReportChannel = { id: "youtube", title: "YouTube", templateEnv: "REPORT_TEMPLATE_YOUTUBE", build: buildYoutube };
