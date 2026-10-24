import "server-only";
import { prisma } from "@/lib/db";

export const findSourceLogImports = (months: string[], sources: string[]) =>
  prisma.import.findMany({
    where: { month: { in: months }, source: { in: sources } },
    select: { month: true, source: true, fileName: true, fileUrl: true, rowCount: true, note: true, createdAt: true, metrics: { select: { key: true, value: true } } },
  });
