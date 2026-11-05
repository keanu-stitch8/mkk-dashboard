import type { PeriodCategory, PeriodMediaSnapshot, PeriodMonth, PeriodPost, PeriodPostMetrics, PeriodReportData, PeriodReportOptions, ReportPeriod } from "../types/period-report";

const METRICS = ["views", "reach", "likes", "comments", "shares", "saves", "follows"] as const;
export const completeTotal = (values: (number | null)[]): number | null => values.length && values.every((v) => v != null) ? values.reduce<number>((a, v) => a + v!, 0) : null;
const categoryName = (v: string | null) => v?.toLowerCase().startsWith("teaser") ? "Teaser" : v;

/** Use one explicit snapshot date for all posts while keeping publication inside the reporting period. */
export function periodPosts(period: ReportPeriod, posts: PeriodPost[], snapshots: PeriodMediaSnapshot[], snapshotDate = period.endDate): PeriodPost[] {
  const last = new Map<string, PeriodMediaSnapshot>();
  for (const s of snapshots) {
    if (s.date === snapshotDate) last.set(s.mediaId, s);
  }
  return posts.filter((p) => p.date >= period.startDate && p.date <= period.endDate).map((p) => {
    const snapshot = last.get(p.postId);
    // Keep the stored cut-off sync when available; a daily snapshot can be earlier on the same day.
    if (p.capturedOn === snapshotDate) return p;
    const metrics = Object.fromEntries(METRICS.map((key) => [key, snapshot?.date && snapshot.date >= p.date ? snapshot[key] : null])) as unknown as PeriodPostMetrics;
    return { ...p, ...metrics, profileVisits: null, capturedOn: snapshot && snapshot.date >= p.date ? snapshot.date : null };
  });
}

export function periodCategories(posts: PeriodPost[]): PeriodCategory[] {
  const groups = new Map<string, PeriodPost[]>();
  for (const p of posts) {
    const label = categoryName(p.category);
    if (label) groups.set(label, [...(groups.get(label) ?? []), p]);
  }
  return [...groups].map(([label, group]) => {
    const recorded = group.filter((post) => post.views != null);
    const views = completeTotal(recorded.map((p) => p.views));
    return { label, posts: group.length, recordedPosts: recorded.length, views, avgViews: views == null ? null : views / recorded.length };
  }).sort((a, b) => (b.avgViews ?? -1) - (a.avgViews ?? -1));
}

export function buildPeriodData(period: ReportPeriod, input: PeriodMonth[], snapshots: PeriodMediaSnapshot[], today: string, options: PeriodReportOptions = {}, postSnapshotDate = period.endDate): PeriodReportData {
  const months = period.months.map((m) => input.find((x) => x.month === m));
  if (months.some((m) => !m)) throw new Error("All four months are required to build a period report.");
  const rows = months as PeriodMonth[];
  const posts = periodPosts(period, rows.flatMap((m) => m.posts), snapshots, postSnapshotDate).map((post) => post.follows != null ? { ...post, followsCsv: null } : { ...post, follows: post.followsCsv?.follows ?? null });
  const warnings: string[] = [];
  const blockedReasons: string[] = [];
  if (today <= period.endDate) blockedReasons.push("This period is still in progress. Generate the report after it ends.");
  const missingMonths = rows.filter((m) => !m.hasAccountData);
  if (missingMonths.length) blockedReasons.push(`Instagram account insights are missing for ${missingMonths.map((m) => m.label).join(", ")}. Sync these months first.`);
  const closingFollowers = rows.at(-1)!.followers.followers;
  const netFollows = completeTotal(rows.map((m) => m.followers.net));
  const openingFollowers = closingFollowers != null && netFollows != null ? closingFollowers - netFollows : null;
  const unlocked = rows.filter((m) => !m.locked);
  if (unlocked.length) warnings.push(`${unlocked.map((m) => m.label).join(", ")} are not locked. Their account totals may change after sync.`);
  if (postSnapshotDate !== period.endDate) warnings.push(`Post metrics use the ${postSnapshotDate} snapshot, not ${period.endDate}. They may include activity after the reporting period. Account totals still cover ${period.rangeLabel}.`);
  if (posts.some((p) => !p.capturedOn)) warnings.push(`Some posts have no metrics captured on ${postSnapshotDate}, the selected snapshot date. Their metrics are shown as n/a; earlier and later snapshots are not substituted.`);
  if (posts.some((p) => p.follows == null)) warnings.push("Some post follows are unavailable. Instagram's API does not provide Reel follows; a CSV export can supplement them.");
  const csvSources = [...new Set(posts.filter((post) => post.followsCsv).map((post) => {
    const csv = post.followsCsv!;
    return csv.observedOn ? `exported ${csv.observedOn}` : `uploaded ${csv.importedOn} (export date unknown)`;
  }))];
  if (csvSources.length) warnings.push(`Per-post follows include lifetime counts from CSV ${csvSources.join(", ")}. They may include follows after the report period; other post metrics retain the ${postSnapshotDate} snapshot.`);
  if (closingFollowers == null) warnings.push("The closing follower total is unavailable.");
  const profileVisits = completeTotal(rows.map((m) => m.profileVisits));
  const linkTaps = completeTotal(rows.map((m) => m.linkTaps));
  const splitViews = completeTotal(rows.map((m) => m.splitViews));
  const nonFollowerViews = completeTotal(rows.map((m) => m.nonFollowerViews));
  const caseCandidates = posts.filter((p) => p.views != null).sort((a, b) => b.views! - a.views! || a.postId.localeCompare(b.postId)).slice(0, 10);
  const topPosts = caseCandidates.slice(0, 5);
  const defaultCase = [...caseCandidates].filter((p) => p.shares != null && p.saves != null).sort((a, b) => (b.shares! + b.saves!) - (a.shares! + a.saves!) || b.views! - a.views!)[0] ?? topPosts[0] ?? null;
  const caseStudy = options.casePostId ? caseCandidates.find((p) => p.postId === options.casePostId) ?? null : defaultCase;
  if (options.casePostId && !caseStudy) throw new Error("Choose a case study from this period's top 10 posts.");
  if (caseStudy && caseStudy.views == null) throw new Error("The selected case study has no views on the selected snapshot date.");
  if (!caseStudy) warnings.push(`No post views are available on ${postSnapshotDate}, the selected snapshot date. Top posts and the case study are shown as n/a.${blockedReasons.length ? "" : " The report can still be generated with the available account totals."}`);
  return {
    period, postSnapshotDate, months: rows, openingFollowers, closingFollowers, followersEstimated: rows.at(-1)!.followers.basis === "estimate", netFollows,
    followsPerDay: netFollows == null ? null : netFollows / period.days,
    views: completeTotal(rows.map((m) => m.views)), interactions: completeTotal(rows.map((m) => m.interactions)),
    profileVisits, linkTaps, linkTapRate: linkTaps != null && profileVisits ? linkTaps / profileVisits : null,
    socialSessions: completeTotal(rows.map((m) => m.socialSessions)),
    nonFollowerViewShare: nonFollowerViews != null && splitViews ? nonFollowerViews / splitViews : null,
    published: rows.reduce((n, m) => n + m.published, 0), stories: rows.reduce((n, m) => n + m.stories, 0),
    feedAndReels: rows.reduce((n, m) => n + m.feedAndReels, 0), quota: completeTotal(rows.map((m) => m.quota)),
    posts, topPosts, caseCandidates, categories: periodCategories(posts), caseStudy, warnings, blockedReasons,
  };
}
