import { resolveMonth } from "@/modules/shared/queries/month-query";
import { OverviewContent } from "../components/overview-content";
import { getOverview } from "../queries/overview-query";

/** Overview selalu dirender (badge "not imported yet" per channel menggantikan empty state). */
export async function OverviewSection({ monthParam }: { monthParam: string | undefined }) {
  const { month } = await resolveMonth(monthParam);
  return <OverviewContent overview={await getOverview(month)} />;
}
