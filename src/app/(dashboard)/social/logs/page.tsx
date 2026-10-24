import SocialLogsModule from "@/modules/social/logs";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function SocialLogsPage({ searchParams }: PageProps<"/social/logs">) {
  return <SocialLogsModule monthParam={firstParam((await searchParams).m)} />;
}
