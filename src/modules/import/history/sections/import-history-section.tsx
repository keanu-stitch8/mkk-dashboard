import { ImportHistoryContent } from "../components/import-history-content";
import { getImportHistoryPage } from "../queries/import-history-query";

/** Header ikut section: deskripsinya menyebut jumlah dataset tersimpan. */
export async function ImportHistorySection({ page }: { page: number }) {
  return <ImportHistoryContent history={await getImportHistoryPage(page)} />;
}
