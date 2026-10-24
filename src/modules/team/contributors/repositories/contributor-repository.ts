import "server-only";
import { prisma } from "@/lib/db";

export const findContributorTabs = () => prisma.contributorTask.findMany({ distinct: ["tab"], select: { tab: true } });

export const findContributorTasks = (tab: string) => prisma.contributorTask.findMany({ where: { tab }, orderBy: { no: "asc" } });

export const findContributors = () => prisma.contributor.findMany({ select: { alias: true, name: true } });

export const findStoryTitles = () => prisma.story.findMany({ select: { code: true, title: true } });
