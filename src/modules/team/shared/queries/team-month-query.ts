import "server-only";
import { cache } from "react";
import { currentMonth } from "@/modules/shared/lib/month";
import { pickTeamMonth } from "../lib/team-links";
import { teamMonths } from "../services/team-month-service";
import type { TeamMonthContext } from "../types/team";

/** Bulan halaman Stories / Briefs / Pipeline / Scorecard: ?m= atau bulan terbaru yang punya Story/Brief. */
export const resolveTeamMonth = cache(async (param: string | undefined): Promise<TeamMonthContext> => {
  const months = await teamMonths();
  const month = pickTeamMonth(param, [months[0]], currentMonth());
  return { month, months: months.length ? months : [month] };
});
