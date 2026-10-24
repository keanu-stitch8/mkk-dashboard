import "server-only";
import { cache } from "react";
import { resolveTeamMonth } from "../../shared/queries/team-month-query";
import { getBriefs } from "../../shared/services/brief-service";
import { buildBriefsPage } from "../lib/briefs-page";
import type { BriefsPage } from "../types/briefs-page";

export const getBriefsPage = cache(async (monthParam: string | undefined): Promise<BriefsPage> => {
  const { month, months } = await resolveTeamMonth(monthParam);
  return buildBriefsPage(month, months, await getBriefs(month));
});
