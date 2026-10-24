import { monthLabel } from "@/modules/shared/lib/month";
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

/** Deskripsi header hanya saat ada data — bulan kosong memakai deskripsi bawaan PageHeader (sama dengan sebelum refactor). */
export async function describeYoutubeOverviewHeader(month: string) {
  return (await getYoutubeOverview(month)).summary.hasData ? `Videos published in ${monthLabel(month)} · performance during ${monthLabel(month)}` : undefined;
}
