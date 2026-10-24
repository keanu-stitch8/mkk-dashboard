import { Suspense } from "react";
import { ChannelOverviewSkeleton } from "@/modules/shared/components/skeletons/channel-overview-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { OverviewSection } from "../sections/overview-section";

export function OverviewView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <MonthHeaderSection title="Overview" monthParam={monthParam} />
      </Suspense>
      <Suspense fallback={<ChannelOverviewSkeleton />}>
        <OverviewSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
