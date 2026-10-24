import { ImportHistoryView } from "./views/import-history-view";

export default function ImportHistoryModule({ page }: { page: number }) {
  return <ImportHistoryView page={page} />;
}
