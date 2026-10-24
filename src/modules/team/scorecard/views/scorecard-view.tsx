import { Suspense } from "react";
import { LogTableSkeleton } from "@/modules/shared/components/skeletons/log-table-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { ScorecardSection } from "../sections/scorecard-section";

export function ScorecardView(props: { monthParam: string | undefined }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <PageHeaderSkeleton />
          <LogTableSkeleton />
        </div>
      }
    >
      <ScorecardSection {...props} />
    </Suspense>
  );
}
