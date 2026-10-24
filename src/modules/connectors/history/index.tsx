import { SyncHistoryView } from "./views/sync-history-view";

export default function SyncHistoryModule(props: { trigger: string | undefined; connector: string | undefined; page: number }) {
  return <SyncHistoryView {...props} />;
}
