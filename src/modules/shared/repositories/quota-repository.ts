import "server-only";
import { prisma } from "@/lib/db";

export const findQuotaRows = (month: string) => prisma.quota.findMany({ where: { month: { in: [month, "default"] } }, select: { month: true, key: true, value: true } });

/** kuota default tersimpan (month "default") */
export const findDefaultQuotaRows = () => prisma.quota.findMany({ where: { month: "default" }, select: { key: true, value: true } });

export const upsertQuota = (month: string, key: string, value: number) => prisma.quota.upsert({ where: { month_key: { month, key } }, update: { value }, create: { month, key, value } });

export const deleteQuota = (month: string, key: string) => prisma.quota.deleteMany({ where: { month, key } });
