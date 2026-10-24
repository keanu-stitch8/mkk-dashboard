import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { pageNumbers } from "@/lib/data/history";

/** Pager halaman riwayat: link ?page=N, parameter lain (mis. filter) dipertahankan. */
export function HistoryPager({ page, pages, path, params = {} }: { page: number; pages: number; path: string; params?: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (n: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: n > 1 ? String(n) : undefined }).filter((e): e is [string, string] => e[1] != null));
    return q.size ? `${path}?${q}` : path;
  };
  return (
    <Pagination className="no-print">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href={href(Math.max(page - 1, 1))} aria-disabled={page === 1} className={page === 1 ? "pointer-events-none opacity-50" : undefined} />
        </PaginationItem>
        {pageNumbers(page, pages).map((n, i) => (
          <PaginationItem key={n ?? `gap-${i}`}>
            {n == null ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink href={href(n)} isActive={n === page}>
                {n}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext href={href(Math.min(page + 1, pages))} aria-disabled={page === pages} className={page === pages ? "pointer-events-none opacity-50" : undefined} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
