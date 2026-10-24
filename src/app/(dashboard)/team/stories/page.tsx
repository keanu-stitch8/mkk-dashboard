import StoriesModule from "@/modules/team/stories";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function StoriesPage({ searchParams }: PageProps<"/team/stories">) {
  const sp = await searchParams;
  return <StoriesModule monthParam={firstParam(sp.m)} showParam={firstParam(sp.show)} />;
}
