import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const findStories = (month: string) => prisma.story.findMany({ where: { month }, orderBy: [{ date: "desc" }, { n: "asc" }] });

export const findStoryMonths = () => prisma.story.findMany({ distinct: ["month"], select: { month: true } });

export const findBriefMonths = () => prisma.brief.findMany({ distinct: ["month"], select: { month: true } });

export const findBriefs = (where: Prisma.BriefWhereInput) => prisma.brief.findMany({ where, orderBy: [{ date: "desc" }, { fileName: "asc" }] });

export const findBriefTasks = () => prisma.briefTask.findMany();

/** pasangan (tanpa yang ditolak tim) untuk item asal, skor tertinggi dulu */
export const findMatchesFrom = (fromType: string, keys: string[]) =>
  prisma.teamMatch.findMany({ where: { fromType, fromKey: { in: keys }, status: { not: "rejected" } }, orderBy: { score: "desc" } });

export const findMatches = (where: Prisma.TeamMatchWhereInput) => prisma.teamMatch.findMany({ where });

/** log IG story (dasar kunci pasangan igstory → artikel) */
export const findInstagramStoryLogs = () =>
  prisma.socialLog.findMany({ where: { format: "story", platform: { contains: "instagram" }, date: { not: null } }, select: { date: true, format: true, title: true, url: true } });
