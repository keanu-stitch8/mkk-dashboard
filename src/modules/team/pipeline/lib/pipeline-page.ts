import { median } from "../../shared/lib/team-links";
import type { PipelineRow, PipelineStage } from "../types/pipeline";
import type { PipelinePage } from "../types/pipeline-page";

const STAGES: PipelineStage[] = ["done", "brief", "article", "check", "missing"];

export function buildPipelinePage(month: string, months: string[], rows: PipelineRow[]): PipelinePage {
  return {
    month,
    months,
    rows,
    counts: Object.fromEntries(STAGES.map((st) => [st, rows.filter((r) => r.stage === st).length])) as Record<PipelineStage, number>,
    published: rows.filter((r) => r.article.match).length,
    lag: median(rows.map((r) => r.repurposeLag).filter((x): x is number => x != null && x >= 0)),
  };
}
