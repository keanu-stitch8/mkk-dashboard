import { Suspense } from "react";

import { ChannelOverviewSkeleton } from "@/modules/shared/components/skeletons/channel-overview-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";

import { SocialOverviewSection } from "../sections/social-overview-section";
import { SocialOverviewHeaderSection } from "../sections/social-overview-header-section";

export function SocialOverviewView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <SocialOverviewHeaderSection monthParam={monthParam} />
      </Suspense>
      <Suspense fallback={<ChannelOverviewSkeleton />}>
        <SocialOverviewSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
