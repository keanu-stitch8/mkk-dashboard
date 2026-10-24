import "server-only";
import { prisma } from "@/lib/db";

export const findMonthImports = (month: string) => prisma.import.findMany({ where: { month }, select: { source: true, fileName: true, createdAt: true } });
