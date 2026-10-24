import { PipelineContent } from "../components/pipeline-content";
import { getPipelinePage } from "../queries/pipeline-query";

/** Header ikut section: pilihan bulan berasal dari data tim. */
export async function PipelineSection({ monthParam, showParam }: { monthParam: string | undefined; showParam: string | undefined }) {
  return <PipelineContent data={await getPipelinePage(monthParam)} showParam={showParam} />;
}
