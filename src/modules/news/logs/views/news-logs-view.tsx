import { Suspense } from "react";
import { LogTableSkeleton } from "@/modules/shared/components/skeletons/log-table-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { describeNewsLogsHeader, NewsLogsSection } from "../sections/news-logs-section";


export function NewsLogsView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <MonthHeaderSection title="Publishing Log" monthParam={monthParam} description={describeNewsLogsHeader} />
      </Suspense>
      <Suspense fallback={<LogTableSkeleton />}>
        <NewsLogsSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
