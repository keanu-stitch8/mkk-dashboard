import PeriodReportModule from "@/modules/report/periods";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function PeriodReportPage({ searchParams }: PageProps<"/report/periods">) {
  return <PeriodReportModule periodParam={firstParam((await searchParams).p)} />;
}
