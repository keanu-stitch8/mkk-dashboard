import "server-only";
import { prisma } from "@/lib/db";

export const findImportMonths = () => prisma.import.findMany({ distinct: ["month"], select: { month: true } });

export const findManualMetricMonths = () => prisma.manualMetric.findMany({ distinct: ["month"], select: { month: true } });
