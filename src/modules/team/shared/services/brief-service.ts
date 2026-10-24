import "server-only";
import type { Prisma } from "@prisma/client";
import { buildBriefRows } from "../lib/team-links";
import { toBriefEntry, toBriefTaskEntry, toTeamMatchEntry } from "../mappers/team-mapper";
import { findBriefTasks, findBriefs, findMatchesFrom } from "../repositories/team-repository";
import type { BriefRow } from "../types/team";

/** Brief + pasangan + status Task Progress, untuk filter apa pun (bulan, atau daftar fileId dari pipeline). */
export async function loadBriefs(where: Pick<Prisma.BriefWhereInput, "month" | "fileId">): Promise<BriefRow[]> {
  const [briefs, tasks] = await Promise.all([findBriefs(where), findBriefTasks()]);
  const matches = await findMatchesFrom("brief", briefs.map((b) => b.fileId));
  return buildBriefRows(briefs.map(toBriefEntry), tasks.map(toBriefTaskEntry), matches.map(toTeamMatchEntry));
}

export const getBriefs = (month: string) => loadBriefs({ month });
