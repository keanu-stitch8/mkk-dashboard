import "server-only";
import { currentMonth } from "@/lib/month";
import { getTrend } from "@/modules/channels/services/trend-service";
import { getAudience } from "@/modules/overview/services/audience-service";
import { SCORECARD_FROM } from "../../scorecard/lib/scorecard";
import { getScorecard } from "../../scorecard/services/scorecard-service";
import { buildRecap, recapRange } from "../lib/recap";
import { findBriefTypesIn, findContributorAssetsIn, findGuidesIn, findPublishedArticlesIn, findPublishedIgLogsIn, findStoryMonthsIn } from "../repositories/recap-repository";
import type { Recap } from "../types/recap";

export async function getRecap(year: string): Promise<Recap> {
  const { first, last, months } = recapRange(year, currentMonth());
  const inYear = { gte: first, lte: last };
  const [stories, guides, contributor, articles, briefs, social, trend, audStart, audEnd] = await Promise.all([
    findStoryMonthsIn(inYear),
    findGuidesIn(inYear),
    findContributorAssetsIn(inYear),
    findPublishedArticlesIn(inYear),
    findBriefTypesIn(inYear),
    findPublishedIgLogsIn(inYear),
    getTrend(last, months.length),
    getAudience(first),
    getAudience(last),
  ]);
  // repurpose: snapshot jika bulan sudah final, selain itu hitungan live (bulan sebelum data tim: kosong)
  const scores = await Promise.all(months.map(async (m) => [m, m >= SCORECARD_FROM ? (await getScorecard(m)).scores.find((s) => s.key === "repurpose") : undefined] as const));
  return buildRecap({ year, first, last, months, stories, guides: guides.length, contributor, articles, briefs, social, trend, audStart, audEnd, repurposeOf: new Map(scores) });
}
