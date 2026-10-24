import "server-only";
import { prisma } from "@/lib/db";
import type { Channel } from "@/lib/parsers/types";

const where = (channel: Channel, key: string, source?: string) => ({ channel, key, ...(source ? { import: { source } } : {}) });

/** snapshot terakhir sebuah metrik (bulan terbaru) */
export const findLatestMetric = (channel: Channel, key: string, source?: string) =>
  prisma.metric.findFirst({ where: where(channel, key, source), orderBy: { month: "desc" }, select: { month: true, value: true } });

/** semua bulan untuk metrik-metrik ini */
export const findMetricHistory = (channel: Channel, keys: string[], source?: string) =>
  prisma.metric.findMany({ where: { OR: keys.map((k) => where(channel, k, source)) }, select: { month: true, key: true, value: true } });

export const findMonthMetric = (month: string, channel: Channel, key: string) => prisma.metric.findFirst({ where: { month, channel, key }, select: { value: true } });
