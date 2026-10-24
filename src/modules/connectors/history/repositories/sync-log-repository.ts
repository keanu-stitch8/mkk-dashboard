import "server-only";
import { prisma } from "@/lib/db";

export const findSyncLogs = (trigger?: string) =>
  prisma.syncLog.findMany({
    where: trigger ? { trigger } : undefined,
    select: { id: true, connector: true, month: true, status: true, rows: true, detail: true, error: true, trigger: true, startedAt: true, finishedAt: true },
    orderBy: { startedAt: "desc" },
  });
