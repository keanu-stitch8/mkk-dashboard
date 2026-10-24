import { Skeleton } from "@/components/ui/skeleton";

/** Mirror YoutubeLogsContent: satu Section berisi tabel log. */
export function YoutubeLogsSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
