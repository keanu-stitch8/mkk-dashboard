import { Suspense } from "react";
import { LogTableSkeleton } from "@/modules/shared/components/skeletons/log-table-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { describeYoutubeLogsHeader, YoutubeLogsSection } from "../sections/youtube-logs-section";


export function YoutubeLogsView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <MonthHeaderSection title="Publishing Log" monthParam={monthParam} description={describeYoutubeLogsHeader} />
      </Suspense>
      <Suspense fallback={<LogTableSkeleton />}>
        <YoutubeLogsSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
