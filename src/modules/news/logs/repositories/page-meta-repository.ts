import "server-only";
import { prisma } from "@/lib/db";

export const findPageMeta = (urls: string[]) => prisma.pageMeta.findMany({ where: { url: { in: urls } }, select: { url: true, ogImage: true, fetchedAt: true } });

export const savePageMeta = (url: string, ogImage: string | null) =>
  prisma.pageMeta.upsert({ where: { url }, create: { url, ogImage }, update: { ogImage, fetchedAt: new Date() } });
