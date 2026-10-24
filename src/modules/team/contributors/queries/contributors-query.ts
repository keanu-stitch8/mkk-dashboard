import "server-only";
import { cache } from "react";
import { currentMonth } from "@/lib/month";
import { pickTeamMonth } from "../../shared/lib/team-links";
import { teamMonths } from "../../shared/services/team-month-service";
import { buildContributorsPage } from "../lib/contributors-page";
import { contributorMonths, getContributors } from "../services/contributor-service";
import type { ContributorsPage } from "../types/contributors-page";

/** Bulan default = tab kontributor terbaru yang sudah ada (bukan bulan Story/Brief terbaru). */
export const getContributorsPage = cache(async (monthParam: string | undefined): Promise<ContributorsPage> => {
  const [withData, team] = await Promise.all([contributorMonths(), teamMonths()]);
  const months = [...new Set([...withData, ...team])].sort().reverse();
  const month = pickTeamMonth(monthParam, [withData[0], months[0]], currentMonth());
  return buildContributorsPage(month, months.length ? months : [month], await getContributors(month));
});
