import SourceLogsModule from "@/modules/source-logs";
import { firstParam } from "@/modules/shared/lib/month-param";

export const dynamic = "force-dynamic";

export default async function LogsPage({ searchParams }: PageProps<"/logs">) {
  return <SourceLogsModule monthParam={firstParam((await searchParams).m)} />;
}
