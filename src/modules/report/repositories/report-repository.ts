import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const findGeneratedReports = (month: string) =>
  prisma.generatedReport.findMany({
    where: { month },
    orderBy: { createdAt: "desc" },
    select: { channel: true, url: true, pdfUrl: true, status: true, createdAt: true, error: true, warnings: true },
  });

export const findMonthLock = (month: string) => prisma.monthLock.findUnique({ where: { month }, select: { month: true } });

/** laporan sukses sebelumnya untuk channel & bulan ini (diberi akhiran "(lama …)" setelah laporan baru jadi) */
export const findPreviousReports = (channel: string, month: string) =>
  prisma.generatedReport.findMany({ where: { channel, month, status: "success", fileId: { not: null } }, select: { fileId: true, pdfFileId: true } });

export const createGeneratedReport = (data: Prisma.GeneratedReportUncheckedCreateInput) => prisma.generatedReport.create({ data });
