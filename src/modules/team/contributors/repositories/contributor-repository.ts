import "server-only";
import { prisma } from "@/lib/db";

export const findContributorTabs = () => prisma.contributorTask.findMany({ distinct: ["tab"], select: { tab: true } });

export const findContributorTasks = (tab: string) => prisma.contributorTask.findMany({ where: { tab }, orderBy: [{ extra: "asc" }, { no: "asc" }] });

export const findAllContributorTasks = () => prisma.contributorTask.findMany({ orderBy: [{ tab: "asc" }, { extra: "asc" }, { no: "asc" }] });

export const findContributors = () => prisma.contributor.findMany({ select: { alias: true, name: true, role: true, newsNames: true, active: true } });

/** Post IG tayang bulan itu (Socmed Content Logs) — dasar Social report. */
export const findPublishedSocial = (month: string) => prisma.socialLog.findMany({ where: { month, status: "publish" }, select: { format: true } });

/** Item IG "in review" akhir bulan (Task Progress, label "format · judul") — dasar Social report. */
export const findSocialInReview = (month: string) =>
  prisma.breakdown.findMany({ where: { month, channel: "social", dimension: "social_in_review", import: { source: "social_review" } }, select: { label: true } });

/** Berita tayang bulan itu menurut News Content Logs (definisi sama dengan report News: status publish). */
export const findPublishedNews = (month: string) => prisma.newsArticle.findMany({ where: { month, status: "publish" }, select: { reporter: true } });

export const findStoryTitles = () => prisma.story.findMany({ select: { code: true, title: true } });
