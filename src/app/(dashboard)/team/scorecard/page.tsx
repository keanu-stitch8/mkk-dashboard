import ScorecardModule from "@/modules/team/scorecard";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function ScorecardPage({ searchParams }: PageProps<"/team/scorecard">) {
  const sp = await searchParams;
  return <ScorecardModule monthParam={firstParam(sp.m)} />;
}
