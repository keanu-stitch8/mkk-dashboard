import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard, KpiGrid, Section } from "@/components/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BADGE } from "@/components/log-badges";
import { MatchLink } from "@/components/team/MatchLink";
import { getBriefs, median, teamMonths } from "@/lib/data/team";
import { currentMonth, isMonth, monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const FILTERS = {
  all: "All",
  waiting: "Not posted",
  check: "Needs confirmation",
  posted: "Posted",
} as const;
type Filter = keyof typeof FILTERS;

const TYPE_BADGE: Record<string, string> = { carousel: BADGE.blue, reel: BADGE.violet };
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-ID", { weekday: "short", day: "numeric", month: "short" });

export default async function BriefsPage({ searchParams }: PageProps<"/team/briefs">) {
  const sp = await searchParams;
  const months = await teamMonths();
  const month = isMonth(sp.m) ? sp.m : (months[0] ?? currentMonth());
  const show: Filter = typeof sp.show === "string" && sp.show in FILTERS ? (sp.show as Filter) : "all";
  const briefs = await getBriefs(month);

  const posted = briefs.filter((b) => b.social.match);
  const check = briefs.filter((b) => !b.social.match && b.social.suggestions.length);
  const waiting = briefs.filter((b) => !b.social.match && !b.social.suggestions.length);
  const lag = median(posted.map((b) => b.lag).filter((x): x is number => x != null));
  const byType = Object.entries(Object.groupBy(briefs, (b) => b.type)).map(([t, list]) => `${list?.length ?? 0} ${t}`);
  const rows = { all: briefs, waiting, check, posted }[show];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Briefs"
        month={month}
        months={months.length ? months : [month]}
        description="Carousel & reel briefs from Content & Creative, and whether each one has been posted on Instagram."
      />

      <KpiGrid cols={4}>
        <KpiCard label="Briefs" value={String(briefs.length)} note={byType.join(" · ") || monthLabel(month)} />
        <KpiCard label="Posted" value={String(posted.length)} note="Matched to an Instagram post (auto or confirmed)" hint="Carousel briefs match feed/carousel posts, reel briefs match reels, within 45 days. Ambiguous matches are not counted until confirmed." />
        <KpiCard label="Needs confirmation" value={String(check.length)} note="Possible post found — confirm or reject it" />
        <KpiCard label="Brief → posted" value={lag == null ? "—" : `${lag} day${lag === 1 ? "" : "s"}`} note={`Median of ${posted.length} posted · ${waiting.length} not posted yet`} />
      </KpiGrid>

      <Section
        title={`Briefs · ${monthLabel(month)}`}
        subtitle="Synced by the Google Drive connector from files named “YYMMDD_Brief Carousel / Reel - Topic”."
        action={
          <div className="flex flex-wrap gap-1">
            {(Object.keys(FILTERS) as Filter[]).map((f) => (
              <Button key={f} asChild size="sm" variant={f === show ? "secondary" : "ghost"}>
                <Link href={`/team/briefs?m=${month}${f === "all" ? "" : `&show=${f}`}`}>{FILTERS[f]}</Link>
              </Button>
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{briefs.length ? "Nothing in this filter." : "No briefs synced for this month yet. Sync the Google Drive connector under Connectors API."}</p>
        ) : (
          <Table className="min-w-[860px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Brief</TableHead>
                <TableHead className="w-[30%]">Instagram</TableHead>
                <TableHead className="w-[26%]">Source article</TableHead>
                <TableHead className="w-16 text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.fileId} className="align-top">
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(b.date)}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant="secondary" className={TYPE_BADGE[b.type] ?? BADGE.gray}>
                        {b.type}
                      </Badge>
                      {b.webViewLink ? (
                        <a href={b.webViewLink} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline">
                          {b.topic}
                          <ExternalLink className="ml-1 inline size-3 text-muted-foreground" />
                        </a>
                      ) : (
                        <span className="font-medium">{b.topic}</span>
                      )}
                      {b.headline && <span className="text-xs text-muted-foreground">{b.headline}</span>}
                      {b.outlineLines.length > 0 && (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer">{b.outlineLines.length} {b.type === "reel" ? "scenes" : "slides"}</summary>
                          <ul className="mt-1 space-y-0.5">
                            {b.outlineLines.map((l, i) => (
                              <li key={i}>{l}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <MatchLink linked={b.social} empty="Not posted yet" />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <MatchLink linked={b.article} empty="—" />
                  </TableCell>
                  <TableCell className="num text-right text-xs text-muted-foreground">{b.lag ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
