import RecapModule from "@/modules/team/recap";
import { firstParam } from "@/modules/shared/lib/month-param";
import { pickYear } from "@/modules/team/recap/lib/recap-year";

export const dynamic = "force-dynamic";

export default async function RecapPage({ searchParams }: PageProps<"/team/recap">) {
  const sp = await searchParams;
  return <RecapModule year={pickYear(firstParam(sp.y), new Date())} />;
}
