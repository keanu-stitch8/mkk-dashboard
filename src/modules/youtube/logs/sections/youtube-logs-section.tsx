import { EmptyState } from "@/components/blocks";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { YoutubeLogsContent } from "../components/youtube-logs-content";
import { getYoutubeLogsPage } from "../queries/youtube-logs-query";

export async function YoutubeLogsSection({ monthParam }: { monthParam: string | undefined }) {
  const { month } = await resolveMonth(monthParam);
  const logs = await getYoutubeLogsPage(month);
  if (!logs.rows.length) return <EmptyState channel="YouTube" month={month} source="MKK Internal - Youtube Calendar Timeline" />;
  return <YoutubeLogsContent logs={logs} />;
}
