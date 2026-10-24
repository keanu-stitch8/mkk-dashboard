import { prevMonth } from "@/modules/shared/lib/month";
import { channelRecommendations } from "@/modules/recommendations/lib/recommendations";
import { atMonth, trendPoints } from "@/modules/shared/lib/by-month";
import { trendMonths } from "@/modules/shared/lib/trend-months";
import type { NewsOverview } from "../types/news-overview";
import type { NewsSummary } from "../types/news-summary";
import { newsQuota } from "./news-quota";
import { newsTrendFields } from "./news-trend";

export function buildNewsOverview(month: string, byMonth: Map<string, NewsSummary>): NewsOverview {
  const summary = atMonth(byMonth, month);
  const prevSummary = atMonth(byMonth, prevMonth(month));
  const prev = prevSummary.hasData ? prevSummary : null;
  return {
    month,
    summary,
    prev,
    quota: newsQuota(summary),
    prevQuota: prev ? newsQuota(prev) : null,
    trend: trendPoints(trendMonths(month), byMonth, newsTrendFields),
    recommendations: channelRecommendations("news", { cur: { month, news: summary }, prev: { month: prevMonth(month), news: prevSummary } }),
  };
}
