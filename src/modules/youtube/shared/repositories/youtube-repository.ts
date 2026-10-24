import "server-only";
import { prisma } from "@/lib/db";

export const findYoutubeVideos = (month: string) => prisma.ytVideo.findMany({ where: { month }, orderBy: { views: "desc" } });

export const findYoutubeMetrics = (month: string) => prisma.metric.findMany({ where: { month, channel: "youtube" } });

export const findYoutubeDaily = (month: string) => prisma.ytDaily.findMany({ where: { month }, orderBy: { date: "asc" } });

export const findYoutubeLogs = (month: string) => prisma.ytLog.findMany({ where: { month }, orderBy: { date: "asc" } });

export const findYoutubeImports = (month: string) => prisma.import.findMany({ where: { month, source: { startsWith: "yt" } }, select: { source: true } });

/** video Review/Approved per akhir bulan dari Gantt Calendar Timeline (connector Sheets) */
export const findYoutubeReviewItems = (month: string) =>
  prisma.breakdown.findMany({ where: { month, channel: "youtube", dimension: "yt_in_review", import: { source: "yt_review" } }, select: { label: true } });

/** video tayang dalam rentang bulan (progres seri produksi di laporan YouTube) */
export const findPublishedYoutubeLogTitles = (from: string, to: string) =>
  prisma.ytLog.findMany({ where: { status: "publish", month: { gte: from, lte: to } }, select: { month: true, title: true, format: true } });
