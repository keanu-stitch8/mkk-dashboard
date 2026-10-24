import { Suspense } from "react";
import { monthLabel } from "@/lib/month";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { YoutubeLogsSection } from "../sections/youtube-logs-section";
import { YoutubeLogsSectionSkeleton } from "../sections/youtube-logs-section-skeleton";

const describe = (month: string) => `All YouTube videos in the ${monthLabel(month)} Calendar Timeline. Click a title to open the video.`;

export function YoutubeLogsView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <MonthHeaderSection title="Publishing Log" monthParam={monthParam} description={describe} />
      </Suspense>
      <Suspense fallback={<YoutubeLogsSectionSkeleton />}>
        <YoutubeLogsSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
