import { prevMonth } from "@/modules/shared/lib/month";
import { channelRecommendations } from "@/modules/recommendations/lib/recommendations";
import { atMonth, trendPoints } from "@/modules/shared/lib/by-month";
import { trendMonths } from "@/modules/shared/lib/trend-months";
import type { YoutubeOverview } from "../types/youtube-overview";
import type { YoutubeSummary } from "../types/youtube-summary";
import { youtubeQuota } from "./youtube-quota";
import { youtubeTrendFields } from "./youtube-trend";

/** Semua yang dirender halaman YouTube, dari ringkasan per bulan (channelPageMonths). */
export function buildYoutubeOverview(month: string, byMonth: Map<string, YoutubeSummary>): YoutubeOverview {
  const summary = atMonth(byMonth, month);
  const prevSummary = atMonth(byMonth, prevMonth(month));
  const prev = prevSummary.hasData ? prevSummary : null;
  return {
    month,
    summary,
    prev,
    quota: youtubeQuota(summary),
    prevQuota: prev ? youtubeQuota(prev) : null,
    trend: trendPoints(trendMonths(month), byMonth, youtubeTrendFields),
    // prev dikirim apa adanya; rule `mom` sendiri memeriksa prev.youtube.hasData
    recommendations: channelRecommendations("youtube", { cur: { month, youtube: summary }, prev: { month: prevMonth(month), youtube: prevSummary } }),
  };
}
