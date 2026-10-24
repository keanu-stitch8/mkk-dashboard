import { channelRecommendations } from "@/lib/recommendations";
import { LAUNCH_MONTH, lastMonths, monthLabel, prevMonth } from "@/lib/month";
import type { YoutubeOverview, YoutubeTrendPoint } from "../types/youtube-overview";
import type { YoutubeSummary } from "../types/youtube-summary";
import { youtubeQuota } from "./youtube-quota";

const TREND_MONTHS = 6;

const trendMonths = (month: string) => lastMonths(month, TREND_MONTHS).filter((m) => m >= LAUNCH_MONTH);

/** Bulan yang ringkasannya dibutuhkan halaman YouTube: tren (sejak launching) + bulan lalu. */
export function youtubeOverviewMonths(month: string): string[] {
  return [...new Set([...trendMonths(month), month, prevMonth(month)])];
}

export function buildYoutubeTrend(summaries: YoutubeSummary[]): YoutubeTrendPoint[] {
  return summaries.map((y) => ({
    month: y.month,
    label: monthLabel(y.month, true),
    published: y.hasData ? y.published : null,
    delivered: y.hasData ? y.delivered : null,
    quota: y.quota.value,
    views: y.hasData ? y.views : null,
  }));
}

/** Semua yang dirender halaman YouTube, dari ringkasan per bulan (lihat youtubeOverviewMonths). */
export function buildYoutubeOverview(month: string, byMonth: Map<string, YoutubeSummary>): YoutubeOverview {
  const at = (m: string) => {
    const s = byMonth.get(m);
    if (!s) throw new Error(`YouTube summary for ${m} was not loaded`);
    return s;
  };
  const summary = at(month);
  const prevSummary = at(prevMonth(month));
  const prev = prevSummary.hasData ? prevSummary : null;
  return {
    month,
    summary,
    prev,
    quota: youtubeQuota(summary),
    prevQuota: prev ? youtubeQuota(prev) : null,
    trend: buildYoutubeTrend(trendMonths(month).map(at)),
    // sama dengan generateRecommendations({ cur, prev }) lama: prev dikirim apa adanya, rule `mom` memeriksa hasData
    recommendations: channelRecommendations("youtube", { cur: { youtube: summary }, prev: { youtube: prevSummary } }),
  };
}
