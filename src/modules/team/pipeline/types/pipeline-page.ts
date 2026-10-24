import type { PipelineRow, PipelineStage } from "./pipeline";

export interface PipelinePage {
  month: string;
  months: string[];
  rows: PipelineRow[];
  counts: Record<PipelineStage, number>;
  /** Story yang artikelnya sudah tayang */
  published: number;
  /** median hari artikel → turunan IG pertama */
  lag: number | null;
}
