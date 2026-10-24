import { ReportContent } from "../components/report-content";
import { getReportPage } from "../queries/report-query";

/** Seluruh halaman Report bergantung pada satu query (toolbar bulan + generator + ringkasan). */
export async function ReportSection({ monthParam }: { monthParam: string | undefined }) {
  return <ReportContent report={await getReportPage(monthParam)} />;
}
