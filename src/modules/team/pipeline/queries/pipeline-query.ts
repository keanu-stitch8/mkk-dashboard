import "server-only";
import { cache } from "react";
import { resolveTeamMonth } from "../../shared/queries/team-month-query";
import { buildPipelinePage } from "../lib/pipeline-page";
import { getPipeline } from "../services/pipeline-service";
import type { PipelinePage } from "../types/pipeline-page";

export const getPipelinePage = cache(async (monthParam: string | undefined): Promise<PipelinePage> => {
  const { month, months } = await resolveTeamMonth(monthParam);
  return buildPipelinePage(month, months, await getPipeline(month));
});
