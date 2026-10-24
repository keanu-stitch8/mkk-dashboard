import { Suspense } from "react";
import { LogTableSkeleton } from "@/modules/shared/components/skeletons/log-table-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { ImportHistorySection } from "../sections/import-history-section";

export function ImportHistoryView({ page }: { page: number }) {
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
        <ImportHistorySection page={page} />
      </Suspense>
    </div>
  );
}
