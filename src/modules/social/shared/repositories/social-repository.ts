import "server-only";
import { prisma } from "@/lib/db";
import { ACTIVE_SOCIAL_PLATFORMS } from "@/lib/sources";

/** hanya platform aktif (lib/sources.ts) yang dihitung ke performa */
export const findActiveSocialPosts = (month: string) =>
  prisma.socialPost.findMany({ where: { month, platform: { in: ACTIVE_SOCIAL_PLATFORMS } }, orderBy: { publishedAt: "asc" } });

export const findSocialLogs = (month: string) => prisma.socialLog.findMany({ where: { month }, orderBy: { date: "asc" } });

export const findSocialImports = (month: string) =>
  prisma.import.findMany({ where: { month, OR: [{ source: { startsWith: "meta" } }, { source: "social_log" }] }, select: { source: true, createdAt: true } });

/** insight akun IG selama bulan itu (connector Meta); kosong untuk bulan hasil import CSV */
export const findIgAccountMetrics = (month: string) =>
  ACTIVE_SOCIAL_PLATFORMS.includes("instagram")
    ? prisma.metric.findMany({ where: { month, channel: "social", key: { startsWith: "ig_account_" }, import: { source: "meta_instagram" } }, select: { key: true, value: true } })
    : Promise.resolve([]);

export const findSocialReviewImport = (month: string) => prisma.import.findUnique({ where: { month_source: { month, source: "social_review" } }, select: { id: true } });

/** konten "Reviewing" dari tracker Task Progress (connector Sheets); kosong = tracker belum di-sync bulan ini */
export const findSocialReviewItems = (month: string) =>
  prisma.breakdown.findMany({ where: { month, channel: "social", dimension: "social_in_review", import: { source: "social_review" } }, select: { label: true } });

/** tanggal snapshot IG pertama dalam rentang [from, to] */
export const findFirstIgSnapshotDate = (from: string, to: string) =>
  prisma.igMediaSnapshot.findFirst({ where: { date: { gte: from, lte: to } }, orderBy: { date: "asc" }, select: { date: true } });

export const findIgSnapshotViews = (date: string) => prisma.igMediaSnapshot.findMany({ where: { date }, select: { mediaId: true, views: true } });

export const findIgAccountByType = (month: string) => prisma.igAccountByType.findMany({ where: { month }, select: { metric: true, type: true, value: true } });

export const findIgStoryDates = (month: string) => prisma.igStory.findMany({ where: { month }, select: { date: true, source: true } });

/** Story pertama yang tercatat dari API (sebelum tanggal ini API belum mengumpulkan Story) */
export const findFirstApiStory = () => prisma.igStory.findFirst({ where: { source: "api" }, orderBy: { date: "asc" }, select: { date: true } });
