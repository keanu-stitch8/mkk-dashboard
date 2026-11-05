import "server-only";
import { prisma } from "@/lib/db";

export const PERIOD_REPORT_CHANNEL = "social_period";

export const findPeriodSnapshots = (mediaIds: string[], startDate: string, endDate: string) =>
  prisma.igMediaSnapshot.findMany({
    where: { mediaId: { in: mediaIds }, date: { gte: startDate, lte: endDate } }, orderBy: { date: "asc" },
    select: { mediaId: true, date: true, views: true, reach: true, likes: true, comments: true, shares: true, saves: true, follows: true },
  });

export const findPeriodLocks = (months: string[]) => prisma.monthLock.findMany({ where: { month: { in: months } }, select: { month: true } });

export const findPeriodReports = (endMonth: string) => prisma.generatedReport.findMany({
  where: { channel: PERIOD_REPORT_CHANNEL, month: endMonth }, orderBy: { createdAt: "desc" }, take: 20,
  select: { url: true, pdfUrl: true, status: true, createdAt: true, warnings: true, error: true },
});
