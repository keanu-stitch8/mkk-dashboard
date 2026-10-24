import { safeDiv, sum } from "@/modules/shared/lib/math";
import type { Ga4PageRow } from "../../shared/types/website";
import type { WebsiteSummary, WebsiteSummaryInput } from "../types/website-summary";

/** Ringkasan Website satu bulan: GA4 + Search Console, ditimpa input manual. */
export function buildWebsiteSummary({ month, sources, channels, pages, landings, metrics, breakdowns, gscDaily, gscQueries, gscPages, manual }: WebsiteSummaryInput): WebsiteSummary {
  const metric = (k: string) => metrics[k] ?? null;

  let sessions: number | null = channels.length ? sum(channels.map((c) => c.sessions)) : metric("landing_sessions");
  let engagedSessions: number | null = channels.length && channels.some((c) => c.engagedSessions != null) ? sum(channels.map((c) => c.engagedSessions)) : null;
  const avgFromChannels = channels.length ? safeDiv(sum(channels.map((c) => (c.avgEngagementTime ?? 0) * c.sessions)), sessions) : null;
  let avgEngagementTime = avgFromChannels;
  let users = metric("users");
  let usersEstimated = false;
  if (users == null && metric("users_est") != null) {
    users = metric("users_est");
    usersEstimated = true;
  }
  let newUsers = metric("newUsers") ?? metric("newUsers_daily") ?? metric("newUsers_est");
  let pageviews: number | null = pages.length ? sum(pages.map((p) => p.views)) : null;

  // total resmi dari API GSC (jika ada) lebih akurat; tanpa itu (import CSV) dihitung dari data harian
  let gscClicks: number | null = metric("gsc_clicks") ?? (gscDaily.length ? sum(gscDaily.map((d) => d.clicks)) : null);
  let gscImpressions: number | null = metric("gsc_impressions") ?? (gscDaily.length ? sum(gscDaily.map((d) => d.impressions)) : null);
  let gscPosition: number | null = metric("gsc_position") ?? (gscDaily.length ? safeDiv(sum(gscDaily.map((d) => d.position * d.impressions)), gscImpressions) : null);

  // override manual
  if (manual.users != null) [users, usersEstimated] = [manual.users, false];
  if (manual.newUsers != null) newUsers = manual.newUsers;
  if (manual.sessions != null) sessions = manual.sessions;
  if (manual.engagedSessions != null) engagedSessions = manual.engagedSessions;
  if (manual.pageviews != null) pageviews = manual.pageviews;
  if (manual.avgEngagementTime != null) avgEngagementTime = manual.avgEngagementTime;
  if (manual.gscClicks != null) gscClicks = manual.gscClicks;
  if (manual.gscImpressions != null) gscImpressions = manual.gscImpressions;
  if (manual.gscPosition != null) gscPosition = manual.gscPosition;
  const engagementRate = manual.engagementRate ?? safeDiv(engagedSessions, sessions);
  const gscCtr = safeDiv(gscClicks, gscImpressions);

  const totalSessions = sum(channels.map((c) => c.sessions));
  const sourceBreakdown = channels
    .map((c) => ({ label: c.channel, sessions: c.sessions, share: safeDiv(c.sessions, totalSessions), engagementRate: c.engagementRate, avgEngagementTime: c.avgEngagementTime }))
    .sort((a, b) => b.sessions - a.sessions);

  // gabungkan path ganda (GA4 Pages bisa memecah per screen class)
  const pageMap = new Map<string, Ga4PageRow>();
  for (const p of pages) {
    const cur = pageMap.get(p.path);
    if (cur) cur.views += p.views;
    else pageMap.set(p.path, { path: p.path, title: p.title, views: p.views, activeUsers: p.activeUsers, avgEngagementTime: p.avgEngagementTime });
  }

  const bd = (dimension: string, m: string) =>
    breakdowns.filter((b) => b.dimension === dimension && b.metric === m).sort((a, b) => b.value - a.value).map((b) => ({ label: b.label, value: b.value }));

  return {
    month,
    hasData: sources.length > 0 || Object.keys(manual).length > 0,
    hasGa4: sources.some((s) => s.startsWith("ga4")) || manual.sessions != null || manual.users != null,
    hasGsc: sources.some((s) => s.startsWith("gsc")) || manual.gscImpressions != null,
    sources,
    users,
    usersEstimated,
    newUsers,
    sessions,
    engagedSessions,
    engagementRate,
    bounceRate: engagementRate == null ? null : 1 - engagementRate,
    avgEngagementTime,
    pageviews,
    hasPages: pages.length > 0,
    gscClicks,
    gscImpressions,
    gscCtr,
    gscPosition,
    sourceBreakdown,
    topPages: [...pageMap.values()].sort((a, b) => b.views - a.views).slice(0, 15),
    topLanding: landings,
    gscDaily,
    topQueries: [...gscQueries].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 15),
    opportunityQueries: gscQueries.filter((q) => q.position >= 4 && q.position <= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 10),
    lowCtrPages: gscPages.filter((p) => p.impressions >= 30 && p.ctr < 0.02).sort((a, b) => b.impressions - a.impressions).slice(0, 5),
    gscTopPages: gscPages.slice(0, 15),
    cities: bd("city", "activeUsers").slice(0, 10),
    devices: bd("device", "clicks"),
    firstChannels: bd("first_channel", "newUsers"),
  };
}
