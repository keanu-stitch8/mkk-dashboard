import ReportModule from "@/modules/report";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  return <ReportModule monthParam={firstParam((await searchParams).m)} />;
}
