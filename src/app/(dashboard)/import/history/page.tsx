import ImportHistoryModule from "@/modules/import/history";
import { pageParam } from "@/modules/shared/lib/page-param";

export const dynamic = "force-dynamic";

export default async function ImportHistoryPage({ searchParams }: PageProps<"/import/history">) {
  return <ImportHistoryModule page={pageParam((await searchParams).page)} />;
}
