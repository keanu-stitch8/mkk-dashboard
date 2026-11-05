import "server-only";
import { prisma } from "@/lib/db";
import { ACTIVE_SOCIAL_PLATFORMS } from "@/modules/shared/lib/sources";
import { CSV_FOLLOWS_DIMENSION, CSV_FOLLOWS_METRIC, CSV_FOLLOWS_SOURCE } from "../lib/csv-follows";

/** hanya platform aktif (modules/shared/lib/sources.ts) yang dihitung ke performa */
export const findActiveSocialPosts = (month: string) =>
  prisma.socialPost.findMany({ where: { month, platform: { in: ACTIVE_SOCIAL_PLATFORMS } }, orderBy: { publishedAt: "asc" } });

export const findCsvPostFollows = (months: string[]) => prisma.breakdown.findMany({
  where: { month: { in: months }, channel: "social", dimension: CSV_FOLLOWS_DIMENSION, metric: CSV_FOLLOWS_METRIC, import: { source: CSV_FOLLOWS_SOURCE } },
  select: { label: true, value: true, import: { select: { note: true, createdAt: true } } },
});

export const findSocialLogs = (month: string) => prisma.socialLog.findMany({ where: { month }, orderBy: { date: "asc" } });

export const findSocialImports = (month: string) =>
  prisma.import.findMany({ where: { month, OR: [{ source: { in: ["meta_instagram", "meta_facebook", "meta_ig_stories"] } }, { source: "social_log" }] }, select: { source: true, createdAt: true } });

/** insight akun IG selama bulan itu (connector Meta); kosong untuk bulan hasil import CSV */
export const findIgAccountMetrics = (month: string) =>
  ACTIVE_SOCIAL_PLATFORMS.includes("instagram")
    ? prisma.metric.findMany({ where: { month, channel: "social", key: { startsWith: "ig_account_" }, import: { source: "meta_instagram" } }, select: { key: true, value: true } })
    : Promise.resolve([]);

export const findSocialReviewImport = (month: string) => prisma.import.findUnique({ where: { month_source: { month, source: "social_review" } }, select: { id: true } });

/** konten "Reviewing" dari tracker Task Progress (connector Sheets); kosong = tracker belum di-sync bulan ini */
export const findSocialReviewItems = (month: string) =>
  prisma.breakdown.findMany({ where: { month, channel: "social", dimension: "social_in_review", import: { source: "social_review" } }, select: { label: true } });

export const findIgSnapshotViews = (date: string) => prisma.igMediaSnapshot.findMany({ where: { date }, select: { mediaId: true, views: true } });

export const findIgAccountByType = (month: string) => prisma.igAccountByType.findMany({ where: { month }, select: { metric: true, type: true, value: true } });

export const findIgStoryDates = (month: string) => prisma.igStory.findMany({ where: { month }, select: { date: true, source: true } });

/** Story pertama yang tercatat dari API (sebelum tanggal ini API belum mengumpulkan Story) */
export const findFirstApiStory = () => prisma.igStory.findFirst({ where: { source: "api" }, orderBy: { date: "asc" }, select: { date: true } });

/** insight akun IG tambahan (profile visits, link bio, follow_type) beberapa bulan sekaligus */
export const findIgAccountMonths = (months: string[]) =>
  prisma.igAccountMonth.findMany({ where: { month: { in: months } }, select: { month: true, metric: true, segment: true, value: true } });

/** semua snapshot total followers IG (satu baris per hari) */
export const findIgFollowerSnapshots = () =>
  prisma.igFollowerSnapshot.findMany({ orderBy: { date: "asc" }, select: { date: true, followers: true, monthFollows: true, monthUnfollows: true } });

/** follow & unfollow akun IG per bulan (insight akun connector Meta, semua bulan) */
export const findIgFollowFlows = () =>
  prisma.metric.findMany({
    where: { channel: "social", key: { in: ["ig_account_follows", "ig_account_unfollows"] }, import: { source: "meta_instagram" } },
    select: { month: true, key: true, value: true },
  });
