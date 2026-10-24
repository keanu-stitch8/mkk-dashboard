import BriefsModule from "@/modules/team/briefs";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function BriefsPage({ searchParams }: PageProps<"/team/briefs">) {
  const sp = await searchParams;
  return <BriefsModule monthParam={firstParam(sp.m)} showParam={firstParam(sp.show)} />;
}
