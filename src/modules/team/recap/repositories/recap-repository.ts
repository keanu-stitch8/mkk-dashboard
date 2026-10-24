import "server-only";
import { prisma } from "@/lib/db";

type Range = { gte: string; lte: string };

export const findStoryMonthsIn = (month: Range) => prisma.story.findMany({ where: { month }, select: { month: true } });

/** satu baris per file panduan */
export const findGuidesIn = (month: Range) => prisma.story.findMany({ where: { month }, distinct: ["fileId"], select: { fileId: true } });

export const findContributorAssetsIn = (tab: Range) => prisma.contributorTask.findMany({ where: { tab }, select: { landscape: true, portrait: true, video: true, interview: true } });

export const findPublishedArticlesIn = (month: Range) =>
  prisma.newsArticle.findMany({ where: { month, status: "publish", import: { source: "news_log" } }, select: { month: true, title: true, url: true, date: true } });

export const findBriefTypesIn = (month: Range) => prisma.brief.findMany({ where: { month }, select: { month: true, type: true } });

export const findPublishedIgLogsIn = (month: Range) =>
  prisma.socialLog.findMany({ where: { month, status: "publish", platform: { contains: "instagram" } }, select: { month: true, format: true } });
