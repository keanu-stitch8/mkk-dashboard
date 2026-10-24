import { monthLabel } from "@/modules/shared/lib/month";
import { EmptyState } from "@/components/blocks";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { NewsOverviewContent } from "../components/news-overview-content";
import { getNewsOverview } from "../queries/news-overview-query";

export async function NewsOverviewSection({ monthParam }: { monthParam: string | undefined }) {
  const { month } = await resolveMonth(monthParam);
  const overview = await getNewsOverview(month);
  if (!overview.summary.hasData) return <EmptyState channel="News" month={month} source="News Content Logs" />;
  return <NewsOverviewContent overview={overview} />;
}

/** Deskripsi header hanya saat ada data — bulan kosong memakai deskripsi bawaan PageHeader (sama dengan sebelum refactor). */
export async function describeNewsOverviewHeader(month: string) {
  return (await getNewsOverview(month)).summary.hasData ? `Articles published in ${monthLabel(month)} · views during ${monthLabel(month)}` : undefined;
}
