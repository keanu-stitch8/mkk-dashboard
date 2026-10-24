import NewsLogsModule from "@/modules/news/logs";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function NewsLogsPage({ searchParams }: PageProps<"/news/logs">) {
  return <NewsLogsModule monthParam={firstParam((await searchParams).m)} />;
}
