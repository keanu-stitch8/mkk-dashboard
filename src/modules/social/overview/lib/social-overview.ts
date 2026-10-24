import { prevMonth } from "@/lib/month";
import { channelRecommendations } from "@/lib/recommendations";
import { atMonth, trendPoints } from "@/modules/shared/lib/by-month";
import { trendMonths } from "@/modules/shared/lib/trend-months";
import type { SocialOverview } from "../types/social-overview";
import type { SocialSummary } from "../types/social-summary";
import { socialKpiSources } from "./social-compare";
import { socialQuota } from "./social-quota";
import { socialTrendFields } from "./social-trend";

export function buildSocialOverview(month: string, byMonth: Map<string, SocialSummary>): SocialOverview {
  const summary = atMonth(byMonth, month);
  const prevSummary = atMonth(byMonth, prevMonth(month));
  const trend = trendPoints(trendMonths(month), byMonth, socialTrendFields);
  return {
    month,
    summary,
    prevSummary,
    kpi: socialKpiSources(summary, prevSummary.hasData ? prevSummary : null),
    quota: socialQuota(summary),
    prevQuota: prevSummary.hasData ? socialQuota(prevSummary) : null,
    trend,
    mixedPlatforms: trend.some((t) => t.viewsFacebook != null) && trend.some((t) => t.viewsInstagram != null),
    recommendations: channelRecommendations("social", { cur: { month, social: summary }, prev: { month: prevMonth(month), social: prevSummary } }),
  };
}
