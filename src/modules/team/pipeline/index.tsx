import { PipelineView } from "./views/pipeline-view";

export default function PipelineModule(props: { monthParam: string | undefined; showParam: string | undefined }) {
  return <PipelineView {...props} />;
}
