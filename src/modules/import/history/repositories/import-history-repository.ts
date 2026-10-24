import "server-only";
import { prisma } from "@/lib/db";

export const findAllImports = () =>
  prisma.import.findMany({ select: { id: true, month: true, source: true, fileName: true, fileUrl: true, rowCount: true, createdAt: true }, orderBy: { createdAt: "desc" } });

/** hapus satu import beserta datanya (cascade); id tidak ada = tidak apa-apa */
export const deleteImport = (id: string) => prisma.import.delete({ where: { id } }).catch(() => null);
