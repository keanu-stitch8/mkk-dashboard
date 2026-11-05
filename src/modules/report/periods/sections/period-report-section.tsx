import { PeriodReportContent } from "../components/period-report-content";
import { getPeriodReportPage } from "../queries/period-report-query";

export async function PeriodReportSection({ periodParam }: { periodParam: string | undefined }) {
  const page = await getPeriodReportPage(periodParam);
  return <PeriodReportContent key={page.data.period.number} page={page} />;
}
