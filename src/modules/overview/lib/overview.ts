import { monthLabel, prevMonth } from "@/lib/month";
import { generateRecommendations } from "@/lib/recommendations";
import { contentQuota } from "@/modules/channels/lib/content-quota";
import { buildTrendPoint } from "@/modules/channels/lib/trend";
import type { MonthBundle } from "@/modules/channels/types/month-bundle";
import { atMonth } from "@/modules/shared/lib/by-month";
import { trendMonths } from "@/modules/shared/lib/trend-months";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import { socialComparable } from "@/modules/social/overview/lib/social-compare";
import type { Audience } from "../types/audience";
import type { Overview, QuotaPair } from "../types/overview";
import { overviewComparison, overviewKpis } from "./overview-kpis";

export function quotaPair(cur: MonthBundle, prev: MonthBundle, channel: QuotaSummary["channel"]): QuotaPair {
  return { cur: contentQuota(cur, channel), prev: prev[channel].hasData ? contentQuota(prev, channel) : null };
}

/** Halaman Overview dari bundle per bulan (tren + bulan lalu) dan audiens bulan ini & bulan lalu. */
export function buildOverview(month: string, bundles: Map<string, MonthBundle>, audience: Audience, prevAudience: Audience): Overview {
  const cur = atMonth(bundles, month);
  const prev = atMonth(bundles, prevMonth(month));
  const cmp = overviewComparison(cur, prev);
  const trend = trendMonths(month).map((m) => ({ ...buildTrendPoint(atMonth(bundles, m)), label: monthLabel(m, true) }));
  return {
    month,
    cur,
    prev,
    channels: [
      { key: "website", label: "Website", has: cur.website.hasData, href: "/website" },
      { key: "news", label: "News", has: cur.news.hasData, href: "/news" },
      { key: "social", label: "Social Media", has: cur.social.hasData, href: "/social" },
      { key: "youtube", label: "YouTube", has: cur.youtube.hasData, href: "/youtube" },
    ],
    quotas: { news: quotaPair(cur, prev, "news"), social: quotaPair(cur, prev, "social"), youtube: quotaPair(cur, prev, "youtube") },
    kpi: overviewKpis(cur),
    cmp,
    anyPartial: !!(cmp.totalReach?.partial || cmp.totalEngagement?.partial),
    socialComparable: socialComparable(cur.social, prev.social),
    socialMixed: trend.some((t) => t.viewsFacebook != null) && trend.some((t) => t.viewsInstagram != null),
    audience,
    prevAudience,
    trend,
    recommendations: generateRecommendations({ cur, prev }),
  };
}
