import { Suspense } from "react";
import { LogTableSkeleton } from "@/modules/shared/components/skeletons/log-table-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { SourceLogsSection } from "../sections/source-logs-section";

const describe = () => "Google Sheets files pulled by the Sheets connector as logs, per month. Click a file name to open it.";

export function SourceLogsView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <MonthHeaderSection title="Source Logs" monthParam={monthParam} description={describe} />
      </Suspense>
      <Suspense fallback={<LogTableSkeleton />}>
        <SourceLogsSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
