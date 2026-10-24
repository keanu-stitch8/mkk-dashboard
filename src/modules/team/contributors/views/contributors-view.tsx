import { Suspense } from "react";
import { LogTableSkeleton } from "@/modules/shared/components/skeletons/log-table-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { ContributorsSection } from "../sections/contributors-section";

export function ContributorsView(props: { monthParam: string | undefined; showParam: string | undefined }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <PageHeaderSkeleton />
          <LogTableSkeleton />
        </div>
      }
    >
      <ContributorsSection {...props} />
    </Suspense>
  );
}
