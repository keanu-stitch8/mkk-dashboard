import { Suspense } from "react";
import { LogTableSkeleton } from "@/modules/shared/components/skeletons/log-table-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { SyncHistorySection } from "../sections/sync-history-section";

export function SyncHistoryView(props: { trigger: string | undefined; connector: string | undefined; page: number }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <LogTableSkeleton />
          </>
        }
      >
        <SyncHistorySection {...props} />
      </Suspense>
    </div>
  );
}
