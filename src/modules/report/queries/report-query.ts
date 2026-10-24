import "server-only";
import { cache } from "react";
import { generateRecommendations } from "@/lib/recommendations";
import { getMonthAndPrev } from "@/modules/channels/services/month-bundle-service";
import { quotaPair } from "@/modules/overview/lib/overview";
import { overviewComparison, overviewKpis } from "@/modules/overview/lib/overview-kpis";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { socialComparable } from "@/modules/social/overview/lib/social-compare";
import { getReportJobs } from "../services/report-jobs-service";
import type { ReportPage } from "../types/report";

export const getReportPage = cache(async (monthParam: string | undefined): Promise<ReportPage> => {
  const { month, months } = await resolveMonth(monthParam);
  const [{ cur, prev }, jobs] = await Promise.all([getMonthAndPrev(month), getReportJobs(month)]);
  return {
    month,
    months,
    cur,
    prev,
    kpi: overviewKpis(cur),
    cmp: overviewComparison(cur, prev),
    quotas: { news: quotaPair(cur, prev, "news"), social: quotaPair(cur, prev, "social"), youtube: quotaPair(cur, prev, "youtube") },
    socialComparable: socialComparable(cur.social, prev.social),
    recommendations: generateRecommendations({ cur, prev }),
    ...jobs,
  };
});
