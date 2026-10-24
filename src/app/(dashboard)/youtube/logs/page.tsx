import YoutubeLogsModule from "@/modules/youtube/logs";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

/** Log video YouTube per bulan — Summary (Calendar Timeline) + in review dari Gantt, tanpa views/metrics. */
export default async function YoutubeLogsPage({ searchParams }: PageProps<"/youtube/logs">) {
  return <YoutubeLogsModule monthParam={firstParam((await searchParams).m)} />;
}
