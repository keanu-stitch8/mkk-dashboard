import "server-only";
import { prisma } from "@/lib/db";

// Baris detail untuk laporan Website bulanan (Google Sheets). Hanya kolom yang dipakai laporan.

export const findReportGa4Channels = (month: string) =>
  prisma.ga4Channel.findMany({
    where: { month },
    orderBy: { sessions: "desc" },
    select: { channel: true, sessions: true, engagedSessions: true, engagementRate: true, avgEngagementTime: true, eventCount: true },
  });

export const findReportGa4Pages = (month: string) => prisma.ga4Page.findMany({ where: { month }, select: { path: true, views: true, activeUsers: true, avgEngagementTime: true, eventCount: true } });

export const findReportGa4Landings = (month: string) =>
  prisma.ga4Landing.findMany({ where: { month }, orderBy: { sessions: "desc" }, select: { path: true, sessions: true, activeUsers: true, newUsers: true, avgEngagementTime: true } });

export const findReportCities = (month: string, country?: string) =>
  prisma.ga4City.findMany({ where: { month, ...(country ? { country } : {}) }, orderBy: { activeUsers: "desc" }, select: { city: true, country: true, activeUsers: true } });

export const findReportGscDaily = (month: string) =>
  prisma.gscDaily.findMany({ where: { month }, orderBy: { date: "asc" }, select: { date: true, clicks: true, impressions: true, ctr: true, position: true } });

export const findReportTopQueries = (month: string) =>
  prisma.gscQuery.findMany({ where: { month }, orderBy: [{ clicks: "desc" }, { impressions: "desc" }], take: 10, select: { query: true, clicks: true, impressions: true, ctr: true, position: true } });

export const findReportTopGscPages = (month: string) =>
  prisma.gscPage.findMany({ where: { month }, orderBy: [{ clicks: "desc" }, { impressions: "desc" }], take: 10, select: { url: true, clicks: true, impressions: true, ctr: true, position: true } });

export const findReportGscBreakdown = (month: string, dimension: "device" | "country") =>
  prisma.breakdown.findMany({ where: { month, channel: "website", dimension }, select: { label: true, metric: true, value: true } });
