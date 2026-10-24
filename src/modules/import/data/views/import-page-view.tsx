import { Suspense } from "react";
import { LogTableSkeleton } from "@/modules/shared/components/skeletons/log-table-skeleton";
import { PageHeaderSkeleton } from "@/modules/shared/components/skeletons/page-header-skeleton";
import { MonthHeaderSection } from "@/modules/shared/sections/month-header-section";
import { ImportPageSection } from "../sections/import-page-section";

const describe = () => "Upload monthly exports. Re-importing the same month & source replaces the existing data.";

export function ImportPageView({ monthParam }: { monthParam: string | undefined }) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <MonthHeaderSection title="Import data" monthParam={monthParam} description={describe} />
      </Suspense>
      <Suspense fallback={<LogTableSkeleton />}>
        <ImportPageSection monthParam={monthParam} />
      </Suspense>
    </div>
  );
}
