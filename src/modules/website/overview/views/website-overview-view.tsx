import { Suspense } from "react";

import { ChannelOverviewSkeleton } from "@/modules/shared/components/skeletons/channel-overview-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { describeWebsiteOverviewHeader, WebsiteOverviewSection } from "../sections/website-overview-section";


export function WebsiteOverviewView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <MonthHeaderSection title="Website" monthParam={monthParam} description={describeWebsiteOverviewHeader} />
      </Suspense>
      <Suspense fallback={<ChannelOverviewSkeleton />}>
        <WebsiteOverviewSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
