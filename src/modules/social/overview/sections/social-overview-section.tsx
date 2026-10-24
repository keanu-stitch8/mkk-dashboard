import { EmptyState } from "@/components/blocks";
import { resolveMonth } from "@/modules/shared/queries/month-query";
import { SocialOverviewContent } from "../components/social-overview-content";
import { getSocialOverview } from "../queries/social-overview-query";

export async function SocialOverviewSection({ monthParam }: { monthParam: string | undefined }) {
  const { month } = await resolveMonth(monthParam);
  const overview = await getSocialOverview(month);
  if (!overview.summary.hasData) return <EmptyState channel="Social Media" month={month} source="Meta Business Suite / publishing log" />;
  return <SocialOverviewContent overview={overview} />;
}
