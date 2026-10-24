import type { Ga4Channel, Ga4Landing, Ga4Page, GscDaily, GscPage, GscQuery } from "@prisma/client";
import type { Ga4ChannelRow, Ga4LandingRow, Ga4PageRow, GscDailyPoint, GscPageRow, GscQueryRow } from "../types/website";

export const toGa4ChannelRow = (c: Ga4Channel): Ga4ChannelRow => ({
  channel: c.channel,
  sessions: c.sessions,
  engagedSessions: c.engagedSessions,
  engagementRate: c.engagementRate,
  avgEngagementTime: c.avgEngagementTime,
});

export const toGa4PageRow = (p: Ga4Page): Ga4PageRow => ({ path: p.path, title: p.title, views: p.views, activeUsers: p.activeUsers, avgEngagementTime: p.avgEngagementTime });

export const toGa4LandingRow = (l: Ga4Landing): Ga4LandingRow => ({
  path: l.path,
  sessions: l.sessions,
  activeUsers: l.activeUsers,
  newUsers: l.newUsers,
  avgEngagementTime: l.avgEngagementTime,
});

export const toGscQueryRow = (q: GscQuery): GscQueryRow => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position });

export const toGscPageRow = (p: GscPage): GscPageRow => ({ url: p.url, path: p.path, clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, position: p.position });

export const toGscDailyPoint = (d: GscDaily): GscDailyPoint => ({ date: d.date, clicks: d.clicks, impressions: d.impressions, ctr: d.ctr, position: d.position });
