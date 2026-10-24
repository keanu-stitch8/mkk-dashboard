import "server-only";
import { prisma } from "@/lib/db";

/** sync terakhir yang sudah selesai untuk satu connector */
export const findLastFinishedSync = (connector: string) =>
  prisma.syncLog.findFirst({ where: { connector, status: { not: "running" } }, orderBy: { startedAt: "desc" }, select: { month: true, status: true, startedAt: true, finishedAt: true } });

export const findMonthLocks = () => prisma.monthLock.findMany({ select: { month: true, lockedAt: true, note: true } });
