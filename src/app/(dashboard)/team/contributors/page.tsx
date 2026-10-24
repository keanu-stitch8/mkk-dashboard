import ContributorsModule from "@/modules/team/contributors";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function ContributorsPage({ searchParams }: PageProps<"/team/contributors">) {
  const sp = await searchParams;
  return <ContributorsModule monthParam={firstParam(sp.m)} showParam={firstParam(sp.show)} />;
}
