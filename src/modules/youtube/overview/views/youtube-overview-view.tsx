import { Suspense } from "react";
import { monthLabel } from "@/lib/month";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { YoutubeOverviewSection } from "../sections/youtube-overview-section";
import { YoutubeOverviewSectionSkeleton } from "../sections/youtube-overview-section-skeleton";

const describe = (month: string) => `Videos published in ${monthLabel(month)} · performance during ${monthLabel(month)}`;

export function YoutubeOverviewView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <MonthHeaderSection title="YouTube" monthParam={monthParam} description={describe} />
      </Suspense>
      <Suspense fallback={<YoutubeOverviewSectionSkeleton />}>
        <YoutubeOverviewSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
