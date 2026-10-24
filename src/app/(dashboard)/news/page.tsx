import NewsOverviewModule from "@/modules/news/overview";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  return <NewsOverviewModule monthParam={firstParam((await searchParams).m)} />;
}
