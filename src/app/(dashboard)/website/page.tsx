import WebsiteOverviewModule from "@/modules/website/overview";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function WebsitePage({ searchParams }: PageProps<"/website">) {
  return <WebsiteOverviewModule monthParam={firstParam((await searchParams).m)} />;
}
