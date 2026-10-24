import { monthLabel } from "@/modules/shared/lib/month";
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

/** Deskripsi header hanya saat ada data — bulan kosong memakai deskripsi bawaan PageHeader (sama dengan sebelum refactor). */
export async function describeYoutubeLogsHeader(month: string) {
  return (await getYoutubeLogsPage(month)).rows.length > 0 ? `All YouTube videos in the ${monthLabel(month)} Calendar Timeline. Click a title to open the video.` : undefined;
}
