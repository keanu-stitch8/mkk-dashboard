import { resolveMonth } from "@/modules/shared/queries/month-query";
import { SourceLogsContent } from "../components/source-logs-content";
import { getSourceLogsPage } from "../queries/source-logs-query";

export async function SourceLogsSection({ monthParam }: { monthParam: string | undefined }) {
  const { month } = await resolveMonth(monthParam);
  return <SourceLogsContent logs={await getSourceLogsPage(month)} />;
}
