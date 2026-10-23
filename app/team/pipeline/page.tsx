import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard, KpiGrid, Section } from "@/components/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BADGE } from "@/components/log-badges";
import { MatchLink } from "@/components/team/MatchLink";
import { getPipeline, type DerivKind, type Derivative, type PipelineStage } from "@/lib/data/pipeline";
import { median, teamMonths } from "@/lib/data/team";
import { currentMonth, isMonth, monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const FILTERS = {
  all: "All stories",
  missing: "No article yet",
  check: "Needs confirmation",
  article: "Waiting for derivative",
  brief: "Brief ready, not posted",
  done: "Done",
} satisfies Record<"all" | PipelineStage, string>;
type Filter = keyof typeof FILTERS;

const TYPE_BADGE: Record<string, string> = { carousel: BADGE.blue, reel: BADGE.violet };
const fmtShort = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-ID", { day: "numeric", month: "short" });
const VIA: Record<Derivative["via"], string> = { brief: "via brief", match: "title match", code: "Story code" };
/** Lebih dari seminggu tertahan → ditandai */
const STUCK_DAYS = 7;

function Derivs({ list, kind }: { list: Derivative[]; kind: DerivKind }) {
  const items = list.filter((d) => d.kind === kind);
  if (!items.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col items-start gap-0.5">
      {items.map((d, i) => (
        <span key={i} title={`${d.title} · ${VIA[d.via]}`} className="whitespace-nowrap">
          {fmtShort(d.date)}
          {d.teaser && <span className="ml-1 text-xs text-muted-foreground">teaser</span>}
        </span>
      ))}
    </div>
  );
}

export default async function PipelinePage({ searchParams }: PageProps<"/team/pipeline">) {
  const sp = await searchParams;
  const months = await teamMonths();
  const month = isMonth(sp.m) ? sp.m : (months[0] ?? currentMonth());
  const show: Filter = typeof sp.show === "string" && sp.show in FILTERS ? (sp.show as Filter) : "all";
  const rows = await getPipeline(month);

  const count = (st: PipelineStage) => rows.filter((r) => r.stage === st).length;
  const published = rows.filter((r) => r.article.match).length;
  const done = count("done");
  const lag = median(rows.map((r) => r.repurposeLag).filter((x): x is number => x != null && x >= 0));
  const visible = show === "all" ? rows : rows.filter((r) => r.stage === show);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Content Pipeline"
        month={month}
        months={months.length ? months : [month]}
        description="Every planned story from the coverage guide to its article, brief, and Instagram derivatives."
      />

      <KpiGrid cols={4}>
        <KpiCard label="Planned stories" value={String(rows.length)} note={`From the coverage guides of ${monthLabel(month)}`} />
        <KpiCard label="Article published" value={String(published)} note={`${count("check")} need confirmation · ${count("missing")} with no article yet`} />
        <KpiCard
          label="Repurposed to Instagram"
          value={published ? `${Math.round((done / published) * 100)}%` : "—"}
          note={`${done} of ${published} published stories have a feed, reel, or IG story`}
          hint="Only counted links: confirmed, Story code, Task Progress, or a strong title match. Suggestions don't count until confirmed."
        />
        <KpiCard label="Article → first IG post" value={lag == null ? "—" : `${lag} day${lag === 1 ? "" : "s"}`} note="Median, teasers excluded" />
      </KpiGrid>

      <Section
        title={`Stories · ${monthLabel(month)}`}
        subtitle={`Days = days since the last finished step (guide, article, or brief), shown in orange after ${STUCK_DAYS} days. Hover a date to see the post title.`}
        action={
          <div className="flex flex-wrap gap-1">
            {(Object.keys(FILTERS) as Filter[]).map((f) => (
              <Button key={f} asChild size="sm" variant={f === show ? "secondary" : "ghost"}>
                <Link href={`/team/pipeline?m=${month}${f === "all" ? "" : `&show=${f}`}`}>
                  {FILTERS[f]}
                  {f !== "all" && <span className="ml-1 text-muted-foreground">{count(f)}</span>}
                </Link>
              </Button>
            ))}
          </div>
        }
      >
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">{rows.length ? "Nothing in this filter." : "No coverage guides synced for this month yet. Sync the Google Drive connector under Connectors API."}</p>
        ) : (
          <Table className="min-w-[1100px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Story</TableHead>
                <TableHead className="w-[24%]">Article</TableHead>
                <TableHead className="w-[17%]">Brief</TableHead>
                <TableHead className="w-24">Feed</TableHead>
                <TableHead className="w-24">Reel</TableHead>
                <TableHead className="w-24">IG Story</TableHead>
                <TableHead className="w-16 text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.code} className="align-top">
                  <TableCell className="whitespace-normal">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{r.code}</span> · guide {fmtShort(r.date)}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <MatchLink linked={r.article} empty="No article yet" />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {r.briefs.length ? (
                      <div className="flex flex-col items-start gap-1.5">
                        {r.briefs.map((b) => (
                          <div key={b.fileId} className="flex flex-col items-start gap-0.5 text-sm">
                            <span className="flex items-center gap-1.5">
                              <Badge variant="secondary" className={TYPE_BADGE[b.type] ?? BADGE.gray}>
                                {b.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{fmtShort(b.date)}</span>
                            </span>
                            {b.webViewLink ? (
                              <a href={b.webViewLink} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                                {b.title}
                                <ExternalLink className="ml-1 inline size-3 text-muted-foreground" />
                              </a>
                            ) : (
                              <span>{b.title}</span>
                            )}
                            {!b.postedOn && <span className="text-xs text-attention">Not posted yet</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Derivs list={r.derivs} kind="feed" />
                  </TableCell>
                  <TableCell className="text-sm">
                    <Derivs list={r.derivs} kind="reel" />
                  </TableCell>
                  <TableCell className="text-sm">
                    <Derivs list={r.derivs} kind="story" />
                  </TableCell>
                  <TableCell className={`num text-right text-sm ${r.stuck != null && r.stuck > STUCK_DAYS ? "font-medium text-attention" : "text-muted-foreground"}`}>
                    {r.stuck ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
