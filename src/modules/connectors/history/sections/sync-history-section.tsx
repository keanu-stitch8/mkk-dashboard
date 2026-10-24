import { SyncHistoryContent } from "../components/sync-history-content";
import { getSyncHistoryPage } from "../queries/sync-history-query";

export async function SyncHistorySection({ trigger, connector, page }: { trigger: string | undefined; connector: string | undefined; page: number }) {
  return <SyncHistoryContent history={await getSyncHistoryPage(trigger, connector, page)} />;
}
