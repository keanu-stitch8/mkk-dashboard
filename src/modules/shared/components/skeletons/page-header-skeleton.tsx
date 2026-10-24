import { Skeleton } from "@/components/ui/skeleton";

/** Fallback MonthHeaderSection: judul + deskripsi di kiri, pilihan bulan di kanan. */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center md:gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-9 w-40" />
    </div>
  );
}
