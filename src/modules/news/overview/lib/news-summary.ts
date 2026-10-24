import { daysInMonth } from "@/lib/month";
import { categoryLabel, newsFormat } from "@/lib/taxonomy";
import { WIB, addDays, dateIn } from "@/lib/tz";
import { longestEmptyStreak } from "@/modules/shared/lib/empty-streak";
import { groupStats } from "@/modules/shared/lib/group-stats";
import { safeDiv, sum } from "@/modules/shared/lib/math";
import type { NewsSummary, NewsSummaryInput } from "../types/news-summary";

/** "A, B & C dan D" → ["A", "B", "C", "D"] */
export const splitPeople = (s: string | null) =>
  (s ?? "")
    .split(/,|&|\/|;|\bdan\b/i)
    .map((x) => x.trim())
    .filter(Boolean);

/** Ringkasan News satu bulan: News Content Logs + views per artikel (GA4 Pages, atau laporan News). */
export function buildNewsSummary({ month, articles, ga4Pages, ga4SyncedAt, reportViews, quota, manual, sources }: NewsSummaryInput): NewsSummary {
  const viewsSource: "ga4" | "report" | null = ga4Pages.length ? "ga4" : reportViews.length ? "report" : null;
  const viewMap = new Map<string, { views: number; activeUsers: number | null; avgEngagementTime: number | null }>();
  for (const p of viewsSource === "ga4" ? ga4Pages : reportViews) {
    const cur = viewMap.get(p.path);
    if (cur) cur.views += p.views;
    else viewMap.set(p.path, { views: p.views, activeUsers: p.activeUsers, avgEngagementTime: p.avgEngagementTime });
  }

  const enriched = articles.map((a) => {
    const hit = a.path ? viewMap.get(a.path) : undefined;
    return {
      ...a,
      matched: !!hit,
      views: hit?.views ?? null,
      activeUsers: hit?.activeUsers ?? null,
      avgEngagementTime: hit?.avgEngagementTime ?? null,
    };
  });
  const publishedList = enriched.filter((a) => a.status === "publish");
  const published = manual.published ?? publishedList.length;
  const inReview = manual.inReview ?? enriched.filter((a) => a.status === "review").length;
  const draft = enriched.filter((a) => a.status === "draft").length;
  const delivered = published + inReview;
  // tanpa artikel published (mis. log belum di-import) views = belum ada data, bukan 0
  const hasViews = !!viewsSource && publishedList.length > 0;
  const totalViews = manual.totalViews ?? (hasViews ? sum(publishedList.map((a) => a.views)) : null);
  // GA4 butuh ±48 jam memproses data: artikel yang tayang ≤1 hari sebelum tanggal sync (WIB = zona properti GA4) wajar belum ada di GA4
  const ga4PendingFrom = viewsSource === "ga4" && ga4SyncedAt ? addDays(dateIn(ga4SyncedAt, WIB), -1) : null;
  const awaitingGa4 = (a: { matched: boolean; date: string | null }) => !a.matched && !!ga4PendingFrom && !!a.date && a.date >= ga4PendingFrom;
  const pendingViews = publishedList.filter(awaitingGa4);
  const unmatched = viewsSource ? publishedList.filter((a) => !a.matched && !awaitingGa4(a)) : [];
  const zeroViews = publishedList.filter((a) => a.matched && (a.views ?? 0) === 0);

  const publishDates = new Set(publishedList.map((a) => a.date).filter((d): d is string => !!d));
  const daily = daysInMonth(month).map((d) => ({ date: d, count: publishedList.filter((a) => a.date === d).length }));

  return {
    month,
    hasData: articles.length > 0 || Object.keys(manual).length > 0,
    sources,
    articles: enriched,
    published,
    inReview,
    draft,
    quota,
    delivered,
    achievement: safeDiv(delivered, quota.value),
    publishedRate: safeDiv(published, quota.value),
    viewsSource,
    totalViews,
    viewsPerArticle: safeDiv(totalViews, publishedList.length || published),
    readers: hasViews ? sum(publishedList.map((x) => x.activeUsers)) : null,
    avgEngagementTime: hasViews
      ? safeDiv(sum(publishedList.map((x) => (x.avgEngagementTime ?? 0) * (x.activeUsers ?? 0))), sum(publishedList.map((x) => (x.avgEngagementTime != null ? x.activeUsers : 0))))
      : null,
    matchedCount: publishedList.filter((a) => a.matched).length,
    unmatched,
    pendingViews,
    zeroViews,
    topArticles: [...publishedList].filter((a) => a.views != null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 10),
    byCategory: groupStats(publishedList, (a) => [categoryLabel(a.category) ?? "(no category)"], (a) => a.views),
    byReporter: groupStats(publishedList, (a) => {
      const p = splitPeople(a.reporter);
      return p.length ? p : ["(no reporter)"];
    }, (a) => a.views),
    byType: groupStats(publishedList, (a) => [newsFormat(a.type) ?? "(no format)"], (a) => a.views),
    daily,
    activeDays: publishDates.size,
    emptyStreak: longestEmptyStreak(month, publishDates),
  };
}
