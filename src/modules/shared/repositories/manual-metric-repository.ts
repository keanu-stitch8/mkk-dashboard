import "server-only";
import { prisma } from "@/lib/db";
import type { Channel } from "@/lib/parsers/types";

export const findManualMetrics = (month: string, channel: Channel) => prisma.manualMetric.findMany({ where: { month, channel } });
