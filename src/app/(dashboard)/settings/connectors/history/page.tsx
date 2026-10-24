import SyncHistoryModule from "@/modules/connectors/history";
import { firstParam } from "@/modules/shared/lib/month-param";
import { pageParam } from "@/modules/shared/lib/page-param";

export const dynamic = "force-dynamic";

export default async function SyncHistoryPage({ searchParams }: PageProps<"/settings/connectors/history">) {
  const sp = await searchParams;
  return <SyncHistoryModule trigger={firstParam(sp.trigger)} connector={firstParam(sp.connector)} page={pageParam(sp.page)} />;
}
