import { EmptyState } from "@/components/blocks";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { WebsiteOverviewContent } from "../components/website-overview-content";
import { getWebsiteOverview } from "../queries/website-overview-query";

export async function WebsiteOverviewSection({ monthParam }: { monthParam: string | undefined }) {
  const { month } = await resolveMonth(monthParam);
  const overview = await getWebsiteOverview(month);
  if (!overview.summary.hasData) return <EmptyState channel="Website" month={month} source="GA4 / Search Console" />;
  return <WebsiteOverviewContent overview={overview} />;
}

/** Deskripsi header hanya saat ada data — bulan kosong memakai deskripsi bawaan PageHeader (sama dengan sebelum refactor). */
export async function describeWebsiteOverviewHeader(month: string) {
  return (await getWebsiteOverview(month)).summary.hasData ? "mainkekudus.com · GA4 + Google Search Console" : undefined;
}
