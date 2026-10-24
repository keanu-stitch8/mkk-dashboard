import Link from "next/link";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard, KpiGrid, Section } from "@/components/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BADGE } from "@/components/log-badges";
import { MatchLink } from "@/components/team/MatchLink";
import { getBriefs, median, teamMonths, type BriefState, type TaskStage } from "@/lib/data/team";
import { currentMonth, isMonth, monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const FILTERS = {
  all: "All",
  posted: "Posted",
  check: "Needs confirmation",
  review: "In review",
  waiting: "Not posted",
} satisfies Record<"all" | BriefState, string>;
type Filter = keyof typeof FILTERS;

const STAGE_BADGE: Record<TaskStage, string> = { published: BADGE.green, review: BADGE.blue, production: BADGE.orange, stopped: BADGE.red };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TYPE_BADGE: Record<string, string> = { carousel: BADGE.blue, reel: BADGE.violet };
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-ID", { weekday: "short", day: "numeric", month: "short" });
const fmtShort = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-ID", { day: "numeric", month: "short" });

type BriefRow = Awaited<ReturnType<typeof getBriefs>>[number];

/** Nama file lama bisa tanpa topik ("260704_Brief Carousel.docx") → pakai judul dari Task Progress / isi brief. */
const title = (b: BriefRow) => b.topic || b.task?.article || b.headline || b.fileName;

/** Status dari Task Progress (diisi editor): status, editor, tanggal submit / tayang, catatan. */
function TaskCell({ task }: { task: BriefRow["task"] }) {
  if (!task) return <span className="text-sm text-muted-foreground">Not in Task Progress</span>;
  const dates = [task.submitted && `Submitted ${fmtShort(task.submitted)}`, task.published && `Published ${fmtShort(task.published)}`].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col items-start gap-1 text-sm">
      {task.status ? (
        <Badge variant="secondary" className={task.stage ? STAGE_BADGE[task.stage] : BADGE.gray}>
          {cap(task.status)}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">No status yet</span>
      )}
      {task.assignee && <span>{task.assignee}</span>}
      {dates && <span className="text-xs text-muted-foreground">{dates}</span>}
      {task.note && <span className="text-xs text-muted-foreground">“{task.note}”</span>}
    </div>
  );
}

export default async function BriefsPage({ searchParams }: PageProps<"/team/briefs">) {
  const sp = await searchParams;
  const months = await teamMonths();
  const month = isMonth(sp.m) ? sp.m : (months[0] ?? currentMonth());
  const show: Filter = typeof sp.show === "string" && sp.show in FILTERS ? (sp.show as Filter) : "all";
  const briefs = await getBriefs(month);

  const by = (s: BriefState) => briefs.filter((b) => b.state === s);
  const groups = { posted: by("posted"), check: by("check"), review: by("review"), waiting: by("waiting") };
  const lag = median(groups.posted.map((b) => b.lag).filter((x): x is number => x != null));
  const byType = Object.entries(Object.groupBy(briefs, (b) => b.type)).map(([t, list]) => `${list?.length ?? 0} ${t}`);
  const tracked = briefs.filter((b) => b.task).length;
  const rows = show === "all" ? briefs : groups[show];

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
        <KpiCard
          label="Posted"
          value={String(groups.posted.length)}
          note={lag == null ? "Published per Task Progress or matched post" : `Median ${lag} day${lag === 1 ? "" : "s"} from brief to post`}
          hint="Counted when Task Progress says Published, or when the brief is matched to an Instagram post (title match, or confirmed by the team). Ambiguous matches are not counted until confirmed."
        />
        <KpiCard label="Needs confirmation" value={String(groups.check.length)} note="Possible post found — confirm or reject it" hint="Also used when Task Progress and the title match disagree (e.g. Task Progress says Reviewing but a similar post exists)." />
        <KpiCard label="In review" value={String(groups.review.length)} note={`Submitted / reviewing in Task Progress · ${groups.waiting.length} not posted`} />
      </KpiGrid>

      <Section
        title={`Briefs · ${monthLabel(month)}`}
        subtitle={`Synced by the Google Drive connector from files named “YYMMDD_Brief Carousel / Reel - Topic”. Editor status from “Social Media - Task Progress” (${tracked} of ${briefs.length} briefs listed there).`}
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
          <Table className="min-w-[1020px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Brief</TableHead>
                <TableHead className="w-36">Task Progress</TableHead>
                <TableHead className="w-[26%]">Instagram</TableHead>
                <TableHead className="w-[22%]">Source article</TableHead>
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
                          {title(b)}
                          <ExternalLink className="ml-1 inline size-3 text-muted-foreground" />
                        </a>
                      ) : (
                        <span className="font-medium">{title(b)}</span>
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
                    <TaskCell task={b.task} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-col items-start gap-2">
                      <MatchLink linked={b.social} empty={b.task?.stage === "published" ? "Not found in the IG log yet" : "Not posted yet"} />
                      {b.task?.igUrl &&
                        (b.task.linkShared ? (
                          <span className="flex items-start gap-1 text-xs text-attention">
                            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                            Task Progress uses the same Instagram link for another brief — check the sheet.
                          </span>
                        ) : (
                          <a href={b.task.igUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                            Instagram link from Task Progress
                            <ExternalLink className="ml-1 inline size-3" />
                          </a>
                        ))}
                    </div>
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
