import "server-only";
import { prisma } from "@/lib/db";
import type { Channel } from "@/modules/shared/types/dataset";

export const findManualMetrics = (month: string, channel: Channel) => prisma.manualMetric.findMany({ where: { month, channel } });

export const findAllManualMetrics = (month: string) => prisma.manualMetric.findMany({ where: { month }, select: { channel: true, key: true, value: true } });

export const upsertManualMetric = (month: string, channel: Channel, key: string, value: number) =>
  prisma.manualMetric.upsert({ where: { month_channel_key: { month, channel, key } }, update: { value }, create: { month, channel, key, value } });

export const deleteManualMetric = (month: string, channel: Channel, key: string) => prisma.manualMetric.deleteMany({ where: { month, channel, key } });
