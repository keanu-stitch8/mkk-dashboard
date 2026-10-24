import { EmptyState } from "@/components/blocks";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { YoutubeOverviewContent } from "../components/youtube-overview-content";
import { getYoutubeOverview } from "../queries/youtube-overview-query";

export async function YoutubeOverviewSection({ monthParam }: { monthParam: string | undefined }) {
  const { month } = await resolveMonth(monthParam);
  const overview = await getYoutubeOverview(month);
  if (!overview.summary.hasData) return <EmptyState channel="YouTube" month={month} source="YouTube Studio" />;
  return <YoutubeOverviewContent overview={overview} />;
}
