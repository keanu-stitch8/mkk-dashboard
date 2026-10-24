import { Suspense } from "react";
import { ChannelOverviewSkeleton } from "@/modules/shared/components/skeletons/channel-overview-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { describeYoutubeOverviewHeader, YoutubeOverviewSection } from "../sections/youtube-overview-section";


export function YoutubeOverviewView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <MonthHeaderSection title="YouTube" monthParam={monthParam} description={describeYoutubeOverviewHeader} />
      </Suspense>
      <Suspense fallback={<ChannelOverviewSkeleton />}>
        <YoutubeOverviewSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
