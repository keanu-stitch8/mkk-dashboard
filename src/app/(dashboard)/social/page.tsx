import SocialOverviewModule from "@/modules/social/overview";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function SocialPage({ searchParams }: PageProps<"/social">) {
  return <SocialOverviewModule monthParam={firstParam((await searchParams).m)} />;
}
