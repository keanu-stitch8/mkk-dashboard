import { monthLabel } from "@/lib/month";
import { EmptyState } from "@/components/blocks";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { NewsLogsContent } from "../components/news-logs-content";
import { getNewsLogsPage } from "../queries/news-logs-query";

export async function NewsLogsSection({ monthParam }: { monthParam: string | undefined }) {
  const { month } = await resolveMonth(monthParam);
  const logs = await getNewsLogsPage(month);
  if (!logs.rows.length) return <EmptyState channel="News" month={month} source="News Content Logs" />;
  return <NewsLogsContent logs={logs} />;
}

/** Deskripsi header hanya saat ada data — bulan kosong memakai deskripsi bawaan PageHeader (sama dengan sebelum refactor). */
export async function describeNewsLogsHeader(month: string) {
  return (await getNewsLogsPage(month)).rows.length > 0 ? `All News articles in the ${monthLabel(month)} content log. Click a title to open the article.` : undefined;
}
