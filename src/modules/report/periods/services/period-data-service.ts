import "server-only";
import { getSocialSummary } from "@/modules/social/overview/services/social-summary-service";
import { getSocialAudience } from "@/modules/social/overview/services/social-audience-service";
import { getWebsiteSummary } from "@/modules/website/overview/services/website-summary-service";
import { monthLabel } from "@/modules/shared/lib/month";
import { dateIn, WIB } from "@/modules/shared/lib/tz";
import { buildPeriodData } from "../lib/period-data";
import { periodPostSnapshotDate, reportPeriod } from "../lib/period";
import { findPeriodLocks, findPeriodSnapshots } from "../repositories/period-report-repository";
import type { PeriodMonth, PeriodPost, PeriodReportData, PeriodReportOptions } from "../types/period-report";

export async function getPeriodReportData(number: number, options: PeriodReportOptions = {}): Promise<PeriodReportData> {
  const period = reportPeriod(number);
  const [bundles, locks] = await Promise.all([
    Promise.all(period.months.map(async (month) => {
      const [social, audience, website] = await Promise.all([getSocialSummary(month), getSocialAudience(month), getWebsiteSummary(month)]);
      return { month, social, audience, website };
    })),
    findPeriodLocks(period.months),
  ]);
  const locked = new Set(locks.map((l) => l.month));
  const months: PeriodMonth[] = bundles.map(({ month, social: s, audience: a, website: w }) => {
    const ig = s.posts.filter((p) => p.platform === "instagram");
    // Output and quota retain the dashboard's business definition, including Stories and manual overrides.
    const formats = new Map(s.publishedByFormat.map((f) => [f.format, f.count]));
    const published = s.postsPublished;
    const stories = formats.get("story") ?? 0;
    const rows = s.byType?.rows ?? [];
    const type = (name: string) => rows.find((r) => r.type === name)?.views ?? null;
    // IgAccountByType keeps the upstream media_product_type names. Unknown types stay in the remainder.
    const carousel = type("CAROUSEL_CONTAINER");
    const reels = type("REEL");
    const story = type("STORY");
    const otherRows = rows.filter((r) => !["CAROUSEL_CONTAINER", "REEL", "STORY"].includes(r.type));
    const other = rows.length && otherRows.every((r) => r.views != null) ? otherRows.reduce((n, r) => n + r.views!, 0) : null;
    const posts: PeriodPost[] = ig.map((p) => ({
      postId: p.postId, title: p.title && !/^https?:\/\//i.test(p.title) ? p.title : p.caption?.split("\n")[0] || "Untitled post", date: p.date,
      format: p.metaFormat, category: p.category, url: p.permalink,
      views: p.views, reach: p.reach, likes: p.likes, comments: p.comments, shares: p.shares, saves: p.saves, follows: p.followsCsv ? p.followsRecorded ?? null : p.follows,
      profileVisits: p.profileVisits, followsCsv: p.followsCsv,
      capturedOn: s.postsAsOf ? dateIn(s.postsAsOf, WIB) : null,
    }));
    const sessions = w.sourceBreakdown.find((r) => r.label.toLowerCase() === "organic social");
    return {
      month, label: monthLabel(month), hasAccountData: s.hasData && s.metricsSource === "account", locked: locked.has(month),
      views: s.views, reach: s.reach, interactions: s.interactions, engagementRate: s.engagementRate,
      followers: a?.followers ?? { month, label: monthLabel(month, true), followers: null, net: null, basis: null, asOf: null },
      profileVisits: a?.discovery?.profileVisits ?? null, linkTaps: a?.discovery?.linkTaps ?? null,
      nonFollowerViews: a?.discovery?.views?.nonFollower ?? null,
      splitViews: a?.discovery?.views ? a.discovery.views.follower + a.discovery.views.nonFollower + a.discovery.views.unknown : null,
      nonFollowerReachShare: a?.discovery?.reach?.nonFollowerShare ?? null,
      published, stories, feedAndReels: [...formats].filter(([format]) => format !== "story").reduce((n, [, count]) => n + count, 0), inReview: s.inReview,
      quota: s.quotaProgress[0]?.quota.value ?? null, socialSessions: w.hasGa4 ? sessions?.sessions ?? 0 : null,
      viewsByType: { carousel, reels, story, other }, posts,
    };
  });
  const postSnapshotDate = periodPostSnapshotDate(period);
  const snapshots = await findPeriodSnapshots(months.flatMap((m) => m.posts.map((p) => p.postId)), postSnapshotDate, postSnapshotDate);
  return buildPeriodData(period, months, snapshots, dateIn(Date.now(), WIB), options, postSnapshotDate);
}
