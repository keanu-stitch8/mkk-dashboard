import "server-only";
import { prisma } from "@/lib/db";

export const setMatchDecision = (id: string, status: "confirmed" | "rejected", decidedBy: string | null) =>
  prisma.teamMatch.update({ where: { id }, data: { status, decidedBy, decidedAt: new Date() } });

/** saran mesin lain untuk item yang sama (asal atau target) */
export const deleteOtherGeneratedMatches = (m: { id: string; fromType: string; fromKey: string; toType: string; toKey: string }, generated: string[]) =>
  prisma.teamMatch.deleteMany({ where: { id: { not: m.id }, status: { in: generated }, toType: m.toType, fromType: m.fromType, OR: [{ fromKey: m.fromKey }, { toKey: m.toKey }] } });
