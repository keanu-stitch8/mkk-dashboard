import { PeriodReportView } from "./views/period-report-view";

export default function PeriodReportModule({ periodParam }: { periodParam: string | undefined }) {
  return <PeriodReportView periodParam={periodParam} />;
}
