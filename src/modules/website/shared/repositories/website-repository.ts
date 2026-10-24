import "server-only";
import { prisma } from "@/lib/db";

export const findWebsiteImports = (month: string) => prisma.import.findMany({ where: { month, source: { startsWith: "g" } }, select: { source: true } });

export const findGa4Channels = (month: string) => prisma.ga4Channel.findMany({ where: { month } });

export const findGa4Pages = (month: string) => prisma.ga4Page.findMany({ where: { month }, orderBy: { views: "desc" } });

export const findTopGa4Landings = (month: string) => prisma.ga4Landing.findMany({ where: { month }, orderBy: { sessions: "desc" }, take: 10 });

export const findWebsiteMetrics = (month: string) => prisma.metric.findMany({ where: { month, channel: "website" }, select: { key: true, value: true } });

export const findWebsiteBreakdowns = (month: string) =>
  prisma.breakdown.findMany({ where: { month, channel: "website" }, select: { dimension: true, label: true, metric: true, value: true } });

export const findGscDaily = (month: string) => prisma.gscDaily.findMany({ where: { month }, orderBy: { date: "asc" } });

export const findGscQueries = (month: string) => prisma.gscQuery.findMany({ where: { month }, orderBy: { impressions: "desc" } });

export const findGscPages = (month: string) => prisma.gscPage.findMany({ where: { month }, orderBy: { clicks: "desc" } });
