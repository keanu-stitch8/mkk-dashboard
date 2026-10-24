import { ReportView } from "./views/report-view";

export default function ReportModule({ monthParam }: { monthParam: string | undefined }) {
  return <ReportView monthParam={monthParam} />;
}
