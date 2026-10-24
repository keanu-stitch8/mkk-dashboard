// Data laporan Website: angka KPI dari summary dashboard (identik dengan dashboard) + tabel detail dari DB.
import {
  findReportCities,
  findReportGa4Channels,
  findReportGa4Landings,
  findReportGa4Pages,
  findReportGscBreakdown,
  findReportGscDaily,
  findReportTopGscPages,
  findReportTopQueries,
} from "@/modules/website/shared/repositories/website-report-repository";
import { getWebsiteSummary } from "@/modules/website/overview/services/website-summary-service";
import { daysInMonth, prevMonth } from "@/modules/shared/lib/month";
import { kpiData, WEBSITE_KPIS } from "../kpi";
import { enMonth } from "../month";
import type { Cell, ReportChannel, ReportData } from "../types";
import { landingPath, topLandings, websiteFindings } from "./website-narrative";

const div = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : a / b);
const sumOf = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const sec = (v: number | null | undefined) => (v == null ? null : Math.round(v));

export async function buildWebsite(month: string): Promise<ReportData> {
  const prev = prevMonth(month);
  const [w, prevWebsite, channels, prevChannels, pages, landings, cityRows, prevCityRows, gscDaily, queries, gscPages, devices, countries] = await Promise.all([
    getWebsiteSummary(month),
    getWebsiteSummary(prev),
    findReportGa4Channels(month),
    findReportGa4Channels(prev),
    findReportGa4Pages(month),
    findReportGa4Landings(month),
    findReportCities(month),
    findReportCities(prev, "Indonesia"),
    findReportGscDaily(month),
    findReportTopQueries(month),
    findReportTopGscPages(month),
    findReportGscBreakdown(month, "device"),
    findReportGscBreakdown(month, "country"),
  ]);
  const p = prevWebsite.hasData ? prevWebsite : null;
  const kpi = kpiData(WEBSITE_KPIS, w, p);

  const totalSessions = sumOf(channels.map((c) => c.sessions));
  const totalEvents = sumOf(channels.map((c) => c.eventCount));
  const channelRows = channels.map((c) => ({
    name: c.channel,
    sessions: c.sessions,
    share: div(c.sessions, totalSessions),
    engaged: c.engagedSessions ?? null,
    er: c.engagementRate ?? null,
    avg_time: sec(c.avgEngagementTime),
    events: c.eventCount ?? null,
    events_per_session: div(c.eventCount, c.sessions),
  }));

  // halaman: gabung path ganda (sama dengan dashboard); waktu engagement ditimbang active users
  const pageMap = new Map<string, { views: number; users: number; time: number; events: number }>();
  for (const pg of pages) {
    const a = pageMap.get(pg.path) ?? { views: 0, users: 0, time: 0, events: 0 };
    a.views += pg.views;
    a.users += pg.activeUsers ?? 0;
    a.time += (pg.avgEngagementTime ?? 0) * (pg.activeUsers ?? 0);
    a.events += pg.eventCount ?? 0;
    pageMap.set(pg.path, a);
  }
  const pageList = [...pageMap.entries()].sort((a, b) => b[1].views - a[1].views);
  const pageRows = pageList.slice(0, 10).map(([path, a]) => ({ path, views: a.views, users: a.users, views_per_user: div(a.views, a.users), avg_time: a.users ? Math.round(a.time / a.users) : null, events: a.events }));

  const landingRows = topLandings(landings).map((l) => ({ path: landingPath(l.path), sessions: l.sessions, users: l.activeUsers ?? null, new_users: l.newUsers ?? null, avg_time: sec(l.avgEngagementTime) }));
  const notSet = landings.find((l) => landingPath(l.path) === "(not set)")?.sessions ?? null;

  // peringkat kota: hanya Indonesia & kota teridentifikasi; luar negeri (umumnya crawler/data center) & "(not set)" dikeluarkan
  const isNotSet = (c: { city: string }) => c.city === "(not set)";
  const idCities = cityRows.filter((c) => c.country === "Indonesia" && !isNotSet(c));
  const outside = cityRows.filter((c) => c.country !== "Indonesia");
  const excluded = {
    outsideUsers: sumOf(outside.map((c) => c.activeUsers)),
    outsideTop: [...new Set(outside.filter((c) => !isNotSet(c)).map((c) => c.city))].slice(0, 3),
    notSetUsers: sumOf(cityRows.filter((c) => c.country === "Indonesia" && isNotSet(c)).map((c) => c.activeUsers)),
  };
  const prevUsersOf = (city: string) => (prevCityRows.length ? (prevCityRows.find((c) => c.city === city)?.activeUsers ?? 0) : null);
  const cities = idCities.slice(0, 10).map((c) => ({ city: c.city, users: c.activeUsers, prevUsers: prevUsersOf(c.city) }));
  const shownUsers = sumOf(cities.map((c) => c.users));
  const prevShown = prevCityRows.length ? sumOf(cities.map((c) => c.prevUsers)) : null;
  const delta = (cur: number | null, before: number | null) => (cur == null || !before ? null : (cur - before) / before);
  const gapUsers = w.users != null ? w.users - shownUsers : null;
  const prevGap = p?.users != null && prevShown != null ? p.users - prevShown : null;
  const kudus = idCities.find((c) => c.city.toLowerCase() === "kudus")?.activeUsers ?? null;

  // GSC device / negara: dua metrik (clicks, impressions) per label
  const gscBreakdown = (rows: typeof devices) =>
    [...new Set(rows.map((r) => r.label))]
      .map((name) => {
        const clicks = rows.find((r) => r.label === name && r.metric === "clicks")?.value ?? 0;
        const impressions = rows.find((r) => r.label === name && r.metric === "impressions")?.value ?? 0;
        return { name, clicks, impressions, ctr: div(clicks, impressions) };
      })
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

  const findings = websiteFindings({
    monthLabel: enMonth(month),
    prevMonthLabel: enMonth(prev),
    users: w.users,
    pageviews: w.pageviews,
    pagePaths: pageMap.size,
    sessions: w.sessions,
    prevSessions: p?.sessions ?? null,
    channels: channelRows.map((c) => ({ label: c.name, sessions: c.sessions, share: c.share, prevSessions: prevChannels.find((x) => x.channel === c.name)?.sessions ?? null })),
    cities,
    excluded,
    notSetSessions: notSet,
    gsc: { clicks: w.gscClicks, impressions: w.gscImpressions, ctr: w.gscCtr, position: w.gscPosition, prevCtr: p?.gscCtr ?? null },
  });

  // Executive Summary: channel & 7 kota teratas berdampingan dalam satu tabel
  const mixLen = Math.max(channelRows.length, Math.min(cities.length, 7));
  const mix = Array.from({ length: mixLen }, (_, i) => {
    const ch = channelRows[i];
    const city = i < 7 ? cities[i] : undefined;
    return {
      ch_name: ch?.name ?? "",
      ch_sessions: ch?.sessions ?? null,
      ch_share: ch?.share ?? null,
      ch_er: ch?.er ?? null,
      city_name: city?.city ?? "",
      city_users: city?.users ?? null,
      city_share: city ? div(city.users, w.users) : null,
    };
  });

  const values: Record<string, Cell> = {
    month_label: enMonth(month),
    prev_month_label: enMonth(prev),
    period: `1–${daysInMonth(month).length} ${enMonth(month)}`,
    ...kpi.values,
    kudus_users: kudus,
    kudus_share: div(kudus, w.users),
    "total.sessions": totalSessions,
    "total.engaged": sumOf(channels.map((c) => c.engagedSessions)),
    "total.er": w.engagementRate,
    "total.avg_time": sec(w.avgEngagementTime),
    "total.events": totalEvents,
    "total.events_per_session": div(totalEvents, totalSessions),
    "cities.shown_users": shownUsers,
    "cities.shown_share": div(shownUsers, w.users),
    "cities.gap_users": gapUsers,
    "cities.prev_shown_users": prevShown,
    "cities.shown_change": delta(shownUsers, prevShown),
    "cities.prev_site_users": p?.users ?? null,
    "cities.site_change": delta(w.users, p?.users ?? null),
    "cities.prev_gap_users": prevGap,
    "cities.gap_change": delta(gapUsers, prevGap),
    "cities.gap_share": w.users ? (w.users - shownUsers) / w.users : null,
    "pages.count": pageMap.size,
    "pages.total_views": w.pageviews,
    "pages.total_users": w.users,
    "pages.total_vpu": div(w.pageviews, w.users),
    "pages.total_avg_time": pageList.length ? Math.round(sumOf(pageList.map(([, a]) => a.time)) / Math.max(1, sumOf(pageList.map(([, a]) => a.users)))) : null,
    "pages.total_events": sumOf(pageList.map(([, a]) => a.events)),
    "landing.count": landings.length,
    "landing.total_sessions": w.sessions,
    "landing.total_users": w.users,
    "landing.total_new_users": w.newUsers,
    "landing.total_avg_time": sec(w.avgEngagementTime),
    "gsc.clicks": w.gscClicks,
    "gsc.impressions": w.gscImpressions,
    "gsc.ctr": w.gscCtr,
    "gsc.position": w.gscPosition,
  };

  return {
    values,
    tones: kpi.tones,
    autoHeight: ["findings", "pages", "landing", "queries", "gsc_pages"],
    // halaman 1 PDF berakhir tepat setelah tabel mix → garis bawah baris terakhirnya tercetak lagi di atas halaman 2
    openEnd: ["mix"],
    tables: {
      mix,
      channels: channelRows,
      cities: cities.map((c, i) => ({ rank: i + 1, city: c.city, users: c.users, share_site: div(c.users, w.users), share_shown: div(c.users, shownUsers), prev_users: c.prevUsers, change: delta(c.users, c.prevUsers) })),
      pages: pageRows,
      landing: landingRows,
      gsc_daily: gscDaily.map((d) => ({ date: d.date, clicks: d.clicks, impressions: d.impressions, ctr: d.ctr, position: d.position })),
      queries: queries.map((q) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position })),
      gsc_pages: gscPages.map((q) => ({ url: q.url, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position })),
      devices: gscBreakdown(devices),
      countries: gscBreakdown(countries),
      findings: findings.map((text) => ({ text })),
    },
  };
}

export const website: ReportChannel = { id: "website", title: "Website", templateEnv: "REPORT_TEMPLATE_WEBSITE", build: buildWebsite };
