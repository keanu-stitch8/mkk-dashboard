import { prevMonth } from "@/lib/month";
import { channelRecommendations } from "@/lib/recommendations";
import { atMonth, trendPoints } from "@/modules/shared/lib/by-month";
import { trendMonths } from "@/modules/shared/lib/trend-months";
import type { WebsiteOverview } from "../types/website-overview";
import type { WebsiteSummary } from "../types/website-summary";
import { websiteTrendFields } from "./website-trend";

export function buildWebsiteOverview(month: string, byMonth: Map<string, WebsiteSummary>): WebsiteOverview {
  const summary = atMonth(byMonth, month);
  const prevSummary = atMonth(byMonth, prevMonth(month));
  return {
    month,
    summary,
    prev: prevSummary.hasData ? prevSummary : null,
    trend: trendPoints(trendMonths(month), byMonth, websiteTrendFields),
    recommendations: channelRecommendations("website", { cur: { month, website: summary }, prev: { month: prevMonth(month), website: prevSummary } }),
  };
}
