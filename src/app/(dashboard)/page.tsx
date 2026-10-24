import OverviewModule from "@/modules/overview";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  return <OverviewModule monthParam={firstParam((await searchParams).m)} />;
}
