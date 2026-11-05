import { Suspense } from "react";
import { ChannelOverviewSkeleton } from "@/modules/shared/components/skeletons/channel-overview-skeleton";
import { PeriodReportSection } from "../sections/period-report-section";

export function PeriodReportView({ periodParam }: { periodParam: string | undefined }) {
  return <Suspense fallback={<div className="flex flex-col gap-6"><ChannelOverviewSkeleton /></div>}><PeriodReportSection periodParam={periodParam} /></Suspense>;
}
