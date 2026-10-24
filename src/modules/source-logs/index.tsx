import { SourceLogsView } from "./views/source-logs-view";

export default function SourceLogsModule({ monthParam }: { monthParam: string | undefined }) {
  return <SourceLogsView monthParam={monthParam} />;
}
