import "server-only";
import { prisma } from "@/lib/db";

export const findNewsArticles = (month: string) => prisma.newsArticle.findMany({ where: { month }, orderBy: { date: "asc" } });

export const findGa4PageViews = (month: string) =>
  prisma.ga4Page.findMany({ where: { month }, select: { path: true, views: true, activeUsers: true, avgEngagementTime: true } });

/** waktu sync GA4 Pages terakhir — artikel yang tayang sesudahnya wajar belum punya views */
export const findLatestGa4PagesImport = (month: string) =>
  prisma.import.findFirst({ where: { month, source: "ga4_pages" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });

export const findNewsReportViews = (month: string) =>
  prisma.newsView.findMany({ where: { month }, select: { path: true, views: true, activeUsers: true, avgEngagementTime: true } });

export const findNewsImports = (month: string) => prisma.import.findMany({ where: { month, source: { startsWith: "news" } }, select: { source: true } });
