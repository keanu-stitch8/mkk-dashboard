// Mapping response GA4 Data API (runReport) → Dataset yang sama dengan hasil parser CSV GA4.
// Murni (tanpa I/O) supaya bisa dites dengan fixture JSON.
import type { Dataset } from "../../parsers/types";
import { normalizePath } from "../../parsers/values";
import { apiDataset, num } from "../common";

/** Bentuk minimal response runReport yang dipakai (kompatibel dengan tipe @google-analytics/data). */
export interface Ga4Report {
  dimensionHeaders?: { name?: string | null }[] | null;
  metricHeaders?: { name?: string | null }[] | null;
  rows?: { dimensionValues?: { value?: string | null }[] | null; metricValues?: { value?: string | null }[] | null }[] | null;
}

export type Ga4Row = Record<string, string>;

/** Ubah rows runReport jadi objek {namaDimensi/namaMetrik: nilai}. */
export function rowsOf(report: Ga4Report): Ga4Row[] {
  const dims = (report.dimensionHeaders ?? []).map((h) => h.name ?? "");
  const mets = (report.metricHeaders ?? []).map((h) => h.name ?? "");
  return (report.rows ?? []).map((r) => {
    const o: Ga4Row = {};
    dims.forEach((d, i) => (o[d] = r.dimensionValues?.[i]?.value ?? ""));
    mets.forEach((m, i) => (o[m] = r.metricValues?.[i]?.value ?? "0"));
    return o;
  });
}

const perUnit = (total: number, count: number) => (count ? total / count : null);

export interface Ga4MonthReports {
  totals: Ga4Report;
  channels: Ga4Report;
  pages: Ga4Report;
  pageTitles: Ga4Report;
  landing: Ga4Report;
  firstChannel: Ga4Report;
  city: Ga4Report;
}

/** Semua dataset GA4 untuk satu bulan. */
export function mapGa4Month(reports: Ga4MonthReports, month: string, source: string): Dataset[] {
  const ds = (key: Parameters<typeof apiDataset>[0], init: Partial<Dataset>) => apiDataset(key, source, month, init);

  // Traffic acquisition per channel (sama dengan CSV "Session primary channel group")
  const channels = rowsOf(reports.channels).map((r) => {
    const sessions = num(r.sessions);
    return {
      channel: r.sessionDefaultChannelGroup || "(not set)",
      sessions,
      engagedSessions: num(r.engagedSessions),
      engagementRate: num(r.engagementRate),
      avgEngagementTime: perUnit(num(r.userEngagementDuration), sessions),
      eventCount: num(r.eventCount),
      users: num(r.activeUsers),
      newUsers: num(r.newUsers),
    };
  });

  // Pages and screens: views per path (+ judul dengan views terbanyak untuk path itu)
  const titleOf = new Map<string, { title: string; views: number }>();
  for (const r of rowsOf(reports.pageTitles)) {
    const path = normalizePath(r.pagePath) ?? r.pagePath;
    const v = num(r.screenPageViews);
    if (!titleOf.has(path) || titleOf.get(path)!.views < v) titleOf.set(path, { title: r.pageTitle, views: v });
  }
  const pageMap = new Map<string, { path: string; title: string | null; views: number; activeUsers: number; engagement: number; eventCount: number }>();
  for (const r of rowsOf(reports.pages)) {
    // normalisasi sama dengan parser CSV (tanpa query string / trailing slash, lowercase) → path ganda digabung
    const path = normalizePath(r.pagePath) ?? r.pagePath;
    const cur = pageMap.get(path) ?? { path, title: titleOf.get(path)?.title ?? null, views: 0, activeUsers: 0, engagement: 0, eventCount: 0 };
    cur.views += num(r.screenPageViews);
    cur.activeUsers += num(r.activeUsers);
    cur.engagement += num(r.userEngagementDuration);
    cur.eventCount += num(r.eventCount);
    pageMap.set(path, cur);
  }
  const pages = [...pageMap.values()].map((p) => ({
    path: p.path,
    title: p.title,
    views: p.views,
    activeUsers: p.activeUsers,
    avgEngagementTime: perUnit(p.engagement, p.activeUsers),
    eventCount: p.eventCount,
  }));

  const landing = rowsOf(reports.landing).map((r) => {
    const sessions = num(r.sessions);
    return {
      path: normalizePath(r.landingPage) ?? r.landingPage,
      sessions,
      activeUsers: num(r.activeUsers),
      newUsers: num(r.newUsers),
      avgEngagementTime: perUnit(num(r.userEngagementDuration), sessions),
    };
  });

  // Total bulan (tanpa dimensi) — users tidak boleh dijumlah dari breakdown
  const total = rowsOf(reports.totals)[0] ?? {};
  const firstChannel = rowsOf(reports.firstChannel).map((r) => ({
    channel: "website" as const,
    dimension: "first_channel",
    label: r.firstUserDefaultChannelGroup || "(not set)",
    metric: "newUsers",
    value: num(r.newUsers),
  }));

  const city = rowsOf(reports.city);
  const cityBreakdowns = city.map((r) => ({ channel: "website" as const, dimension: "city", label: r.city || "(not set)", metric: "activeUsers", value: num(r.activeUsers) }));

  const out: Dataset[] = [
    ds("ga4_traffic", { rows: channels }),
    ds("ga4_pages", { rows: pages }),
    ds("ga4_landing", {
      rows: landing,
      metrics: [{ channel: "website", key: "landing_sessions", value: landing.reduce((a, r) => a + r.sessions, 0) }],
    }),
    ds("ga4_overview", {
      metrics: [
        { channel: "website", key: "users", value: num(total.activeUsers) },
        { channel: "website", key: "newUsers", value: num(total.newUsers) },
      ],
      breakdowns: firstChannel,
    }),
    ds("ga4_city", {
      breakdowns: cityBreakdowns,
      metrics: [{ channel: "website", key: "users_est", value: city.reduce((a, r) => a + num(r.activeUsers), 0) }],
    }),
  ];
  return out;
}
