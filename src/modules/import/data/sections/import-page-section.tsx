import { resolveMonth } from "@/modules/shared/queries/month-query";
import { ImportPageContent } from "../components/import-page-content";
import { getImportPageData } from "../queries/import-page-query";

export async function ImportPageSection({ monthParam }: { monthParam: string | undefined }) {
  const { month } = await resolveMonth(monthParam);
  return <ImportPageContent data={await getImportPageData(month)} />;
}
