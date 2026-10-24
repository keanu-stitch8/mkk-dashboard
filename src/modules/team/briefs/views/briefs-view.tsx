import { Suspense } from "react";
import { LogTableSkeleton } from "@/modules/shared/components/skeletons/log-table-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { BriefsSection } from "../sections/briefs-section";

export function BriefsView(props: { monthParam: string | undefined; showParam: string | undefined }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <PageHeaderSkeleton />
          <LogTableSkeleton />
        </div>
      }
    >
      <BriefsSection {...props} />
    </Suspense>
  );
}
