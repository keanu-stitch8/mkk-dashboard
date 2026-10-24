import { Suspense } from "react";
import { ChannelOverviewSkeleton } from "@/modules/shared/components/skeletons/channel-overview-skeleton";
import { ReportSection } from "../sections/report-section";

export function ReportView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <ChannelOverviewSkeleton />
        </div>
      }
    >
      <ReportSection monthParam={monthParam} />
    </Suspense>
  );
}
