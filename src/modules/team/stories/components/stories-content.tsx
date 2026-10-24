import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard, KpiGrid, Section } from "@/components/blocks";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { monthLabel } from "@/lib/month";
import type { StoriesPage } from "../types/stories-page";
import { MatchLink } from "../../shared/components/match-link";

const FILTERS = {
  all: "All",
  missing: "No article yet",
  check: "Needs confirmation",
  done: "Published",
} as const;
type Filter = keyof typeof FILTERS;

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-ID", { weekday: "short", day: "numeric", month: "short" });

export function StoriesContent({ data, showParam }: { data: StoriesPage; showParam: string | undefined }) {
  const { month, months, stories, done, check, missing, lag } = data;
  const show: Filter = showParam && showParam in FILTERS ? (showParam as Filter) : "all";
  const rows = { all: stories, missing, check, done }[show];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stories"
        month={month}
        months={months.length ? months : [month]}
        description="Every planned article from the daily coverage guides (PANDUAN LIPUTAN), and whether it has been published."
      />

      <KpiGrid cols={4}>
        <KpiCard label="Planned articles" value={String(stories.length)} note={`From the coverage guides of ${monthLabel(month)}`} hint="Each “Artikel N” in a daily coverage guide is one story. Code = guide date + article number." />
        <KpiCard label="Published" value={String(done.length)} note="Matched to News Content Logs (auto or confirmed)" hint="Only strong title matches are matched automatically. Ambiguous ones wait for confirmation and are not counted here." />
        <KpiCard label="Needs confirmation" value={String(check.length)} note="Possible article found — confirm or reject it" />
        <KpiCard label="Guide → published" value={lag == null ? "—" : `${lag} day${lag === 1 ? "" : "s"}`} note={`Median of ${done.length} published · ${missing.length} with no article yet`} />
      </KpiGrid>

      <Section
        title={`Planned articles · ${monthLabel(month)}`}
        subtitle="Synced by the Google Drive connector. A story with no article yet may still be in review, retitled, or unpublished."
        action={
          <div className="flex flex-wrap gap-1">
            {(Object.keys(FILTERS) as Filter[]).map((f) => (
              <Button key={f} asChild size="sm" variant={f === show ? "secondary" : "ghost"}>
                <Link href={`/team/stories?m=${month}${f === "all" ? "" : `&show=${f}`}`}>{FILTERS[f]}</Link>
              </Button>
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{stories.length ? "Nothing in this filter." : "No coverage guides synced for this month yet. Sync the Google Drive connector under Connectors API."}</p>
        ) : (
          <Table className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead className="w-28">Guide date</TableHead>
                <TableHead>Planned article</TableHead>
                <TableHead className="w-[38%]">Article</TableHead>
                <TableHead className="w-16 text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.code} className="align-top">
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(s.date)}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="font-medium">{s.title}</div>
                    {s.angle && (
                      <details className="mt-1 text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Angle</summary>
                        <p className="mt-1">{s.angle}</p>
                      </details>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <MatchLink linked={s.article} empty="No article found yet" />
                  </TableCell>
                  <TableCell className="num text-right text-xs text-muted-foreground">{s.lag ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
