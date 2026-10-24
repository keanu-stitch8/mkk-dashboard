import { Suspense } from "react";
import { ChannelOverviewSkeleton } from "@/modules/shared/components/skeletons/channel-overview-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { describeNewsOverviewHeader, NewsOverviewSection } from "../sections/news-overview-section";


export function NewsOverviewView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <MonthHeaderSection title="News" monthParam={monthParam} description={describeNewsOverviewHeader} />
      </Suspense>
      <Suspense fallback={<ChannelOverviewSkeleton />}>
        <NewsOverviewSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
