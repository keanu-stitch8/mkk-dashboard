import { Suspense } from "react";
import { LogTableSkeleton } from "@/modules/shared/components/skeletons/log-table-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { RecapSection } from "../sections/recap-section";

export function RecapView(props: { year: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <PageHeaderSkeleton />
          <LogTableSkeleton />
        </div>
      }
    >
      <RecapSection {...props} />
    </Suspense>
  );
}
