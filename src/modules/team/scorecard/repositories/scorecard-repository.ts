import "server-only";
import { prisma } from "@/lib/db";
import type { Score } from "../types/scorecard";

/** artikel tayang bulan ini dari News Content Logs (baris "in review" tambahan tidak dihitung) */
export const findPublishedArticles = (month: string) =>
  prisma.newsArticle.findMany({ where: { month, status: "publish", import: { source: "news_log" }, date: { not: null } }, select: { title: true, url: true, date: true } });

export const findContributorAssetStates = (tab: string) =>
  prisma.contributorTask.findMany({ where: { tab }, select: { landscape: true, portrait: true, video: true, interview: true } });

export const findScoreSnapshot = (month: string) => prisma.teamScore.findMany({ where: { month } });

export const replaceScoreSnapshot = (month: string, scores: Score[]) =>
  prisma.$transaction([prisma.teamScore.deleteMany({ where: { month } }), prisma.teamScore.createMany({ data: scores.map((s) => ({ month, ...s })) })]);

export const deleteScoreSnapshot = (month: string) => prisma.teamScore.deleteMany({ where: { month } });
