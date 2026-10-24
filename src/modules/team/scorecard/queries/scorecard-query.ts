import "server-only";
import { cache } from "react";
import { resolveTeamMonth } from "../../shared/queries/team-month-query";
import { scorecardHistory } from "../services/scorecard-service";
import type { ScorecardMonth } from "../types/scorecard";

export const getScorecardPage = cache(async (monthParam: string | undefined): Promise<{ month: string; months: string[]; history: ScorecardMonth[] }> => {
  const { month, months } = await resolveTeamMonth(monthParam);
  return { month, months, history: await scorecardHistory(month) };
});
