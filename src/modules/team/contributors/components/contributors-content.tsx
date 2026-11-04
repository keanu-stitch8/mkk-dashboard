import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard, KpiGrid, Section } from "@/components/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BADGE } from "@/components/log-badges";
import { ASSETS, type AssetCell } from "@/modules/team/ingest/contributors";
import { monthLabel } from "@/modules/shared/lib/month";
import type { ContributorsPage } from "../types/contributors-page";
import type { ContributorItem } from "../types/contributors";

const FILTERS = {
  all: "All",
  incomplete: "Incomplete assets",
  reel: "Reel-ready",
  none: "Nothing reported",
} as const;
type Filter = keyof typeof FILTERS;

const match = (f: Filter, it: ContributorItem) => (f === "incomplete" ? it.reported && !it.complete : f === "reel" ? it.reelReady : f === "none" ? !it.reported : true);
/** konten bisa pecahan (artikel ditulis bersama) → maks. 2 desimal, format Indonesia */
const fmtN = (v: number) => v.toLocaleString("en-ID", { maximumFractionDigits: 2 });
const fmtShort = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-ID", { day: "numeric", month: "short" });

function Asset({ c, names }: { c: AssetCell; names: Record<string, string> }) {
  const who = c.by ? (names[c.by.toUpperCase()] ?? c.by) : null;
  if (c.state === "available")
    return (
      <span className="flex items-center gap-1 whitespace-nowrap text-success" title={who ? `by ${who}` : undefined}>
        <Check className="size-3.5" />
        <span className="text-foreground">{c.at ? fmtShort(c.at) : "Yes"}</span>
      </span>
    );
  if (c.state === "missing")
    return (
      <span className="flex items-center gap-1 text-muted-foreground" title="Contributor marked it Not Available">
        <X className="size-3.5" /> N/A
      </span>
    );
  return <Minus className="size-3.5 text-muted-foreground/60" aria-label="Not filled in yet" />;
}

export function ContributorsContent({ data, showParam }: { data: ContributorsPage; showParam: string | undefined }) {
  const { month, months, items, people, nameOf, target, content, extra, complete, reported, carousel, reel, news, ig, recap } = data;
  const others = Object.entries(news.others).sort((a, b) => b[1] - a[1]);
  const show: Filter = showParam && showParam in FILTERS ? (showParam as Filter) : "all";
  const rows = items.filter((i) => match(show, i));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contributors"
        month={month}
        months={months.length ? months : [month]}
        description="Field assets from local contributors in Kudus, per planned story — what the Bogor team can turn into articles and reels."
      />

      {items.length === 0 ? (
        <Section title={monthLabel(month)}>
          <p className="text-sm text-muted-foreground">
            The {monthLabel(month)} tab of “Local Contributor - Task Progress” hasn&apos;t been filled in yet. Fill it in, then sync the Google Drive connector under Connectors API.
          </p>
        </Section>
      ) : (
        <>
          <KpiGrid cols={4}>
            <KpiCard
              label="Content delivered"
              value={`${content} / ${target}`}
              note={`${Math.round((content / target) * 100)}% of the monthly target · ${complete} with complete assets${extra ? ` · ${extra} extra` : ""}`}
              hint="1 content = 1 article with status Submitted (contributors are paid per content), including the Extra Posts tab — same as the Master Report tab. Photos, portrait video and interview can be incomplete; they're shown below as info."
            />
            <KpiCard
              label="Articles → Website"
              value={String(news.byContributors)}
              note={`of ${news.published} news published on mainkekudus.com · ${content} delivered`}
              hint={`News published this month (News Content Logs, same as the News report) whose Reporter column names a local contributor. Names are matched to the alias or “News Name” column in the Ref tab, never guessed.${others.length ? ` Not local contributors: ${others.map(([n, c]) => `${n} (${c})`).join(", ")}.` : ""}`}
            />
            <KpiCard
              label="Carousel-ready"
              value={String(carousel)}
              note={`stories with photos · IG this month: ${ig.feedLive} carousels live${ig.feedReview ? ` + ${ig.feedReview} in review` : ""}`}
              hint={`Carousel-ready = planned stories with a landscape or portrait photo marked Available (${reported} stories have assets reported). IG this month = all carousels (Feed), same as the Social report: live from the Socmed Content Logs, in review from Social Media - Task Progress.`}
            />
            <KpiCard
              label="Reel-ready"
              value={String(reel)}
              note={`stories with portrait video · IG this month: ${ig.reelLive} reels live${ig.reelReview ? ` + ${ig.reelReview} in review` : ""}`}
              hint={`Reel-ready = planned stories with a portrait video marked Available (${items.filter((i) => i.reelReady && i.assets.interview.state === "available").length} also with interview). IG this month = all reels, same as the Social report: live from the Socmed Content Logs, in review from Social Media - Task Progress.`}
            />
          </KpiGrid>

          <Section
            title={`Stories · ${monthLabel(month)}`}
            subtitle="From “MKK Kudus Local Contributor - Task Progress”. ✓ = available (date sent), N/A = contributor has none, – = not filled in yet. Hover ✓ to see who sent it."
            action={
              <div className="flex flex-wrap gap-1">
                {(Object.keys(FILTERS) as Filter[]).map((f) => (
                  <Button key={f} asChild size="sm" variant={f === show ? "secondary" : "ghost"}>
                    <Link href={`/team/contributors?m=${month}${f === "all" ? "" : `&show=${f}`}`}>{FILTERS[f]}</Link>
                  </Button>
                ))}
              </div>
            }
          >
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing in this filter.</p>
            ) : (
              <Table className="min-w-[1080px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Planned</TableHead>
                    <TableHead>Story</TableHead>
                    <TableHead className="w-32">Article</TableHead>
                    {ASSETS.map((a) => (
                      <TableHead key={a.key} className="w-24 whitespace-normal leading-tight">
                        {a.label}
                      </TableHead>
                    ))}
                    <TableHead className="w-24 text-right">Last asset</TableHead>
                    <TableHead className="w-28">Reel-ready</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((it) => (
                    <TableRow key={it.id} className="align-top">
                      <TableCell className="text-xs text-muted-foreground">{it.planned ? fmtShort(it.planned) : "—"}</TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">
                          {it.title}
                          {it.extra && (
                            <Badge variant="secondary" className={`ml-2 align-middle ${BADGE.gray}`}>
                              Extra
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {it.storyCode ? (
                            <Link href={`/team/pipeline?m=${month}`} className="font-mono underline-offset-2 hover:underline" title={it.storyTitle ?? undefined}>
                              {it.storyCode}
                            </Link>
                          ) : (
                            <span title="No planned article with a matching title in that day's coverage guide">Not linked to a coverage guide</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {it.status ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <Badge variant="secondary" className={it.status === "submitted" ? BADGE.green : BADGE.gray}>
                              {it.status.charAt(0).toUpperCase() + it.status.slice(1)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {[
                                it.credit.length ? it.credit.map(([a, share]) => `${nameOf[a] ?? a}${share < 1 ? ` (${fmtN(share)})` : ""}`).join(", ") : it.articleBy,
                                it.articleAt && fmtShort(it.articleAt),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {it.web ? (
                              it.web.url ? (
                                <a href={it.web.url} target="_blank" rel="noreferrer" className="text-xs text-success underline-offset-2 hover:underline" title={it.web.title}>
                                  Live on web{it.web.date ? ` · ${fmtShort(it.web.date)}` : ""}
                                </a>
                              ) : (
                                <span className="text-xs text-success" title={it.web.title}>
                                  Live on web{it.web.date ? ` · ${fmtShort(it.web.date)}` : ""}
                                </span>
                              )
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {ASSETS.map((a) => (
                        <TableCell key={a.key} className="text-sm">
                          <Asset c={it.assets[a.key]} names={nameOf} />
                        </TableCell>
                      ))}
                      <TableCell className="num text-right text-sm text-muted-foreground">
                        {it.lastAsset ? fmtShort(it.lastAsset) : "—"}
                        {it.assetLag != null && <div className="text-xs">+{it.assetLag} days</div>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {it.reelReady ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <Badge variant="secondary" className={BADGE.green}>
                              Yes
                            </Badge>
                            {it.assets.interview.state !== "available" && <span className="text-xs text-muted-foreground">No interview</span>}
                          </div>
                        ) : it.reported ? (
                          <span className="text-muted-foreground">No video</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section
            title={`By contributor · ${monthLabel(month)}`}
            subtitle="Content = submitted articles; an article written together is split equally (0,5 / 0,33), same as the Master Report. Footage-only contributors (Role in the Ref tab) count stories with their footage."
          >
            <KpiGrid cols={4}>
              {people.map((p) => (
                <KpiCard
                  key={p.alias}
                  label={`${p.name ?? p.alias} · ${p.alias}`}
                  value={p.footageOnly ? String(p.footage) : fmtN(p.content)}
                  note={
                    p.footageOnly
                      ? `stories with footage · ${p.assets} assets · ${p.web} on web`
                      : `content delivered${content ? ` · ${Math.round((p.content / content) * 100)}% of ${content}` : ""} · ${p.web} on web · ${p.assets} assets`
                  }
                  hint={`Role: ${p.role ?? "not set in the Ref tab"}.${p.active ? "" : " Inactive."} On web = news published this month with this person in the Reporter column.${p.lag == null ? "" : ` Planned → asset: ${p.lag} days (median).`}`}
                />
              ))}
            </KpiGrid>
          </Section>

          <Section title="Monthly recap" subtitle="Every month in the tracker, counted like the Master Report tab. A difference from the sheet's Master Report shows up as a warning when Google Drive is synced.">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Month</TableHead>
                  <TableHead className="text-right">Content</TableHead>
                  {recap.writers.map((a) => (
                    <TableHead key={a} className="text-right font-mono" title={nameOf[a]}>
                      {a}
                    </TableHead>
                  ))}
                  {recap.footage.map((a) => (
                    <TableHead key={a} className="text-right" title={nameOf[a]}>
                      Footage <span className="font-mono">{a}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recap.months.map((m) => (
                  <TableRow key={m.month} className={m.month === month ? "bg-muted/50" : undefined}>
                    <TableCell>
                      <Link href={`/team/contributors?m=${m.month}`} className="underline-offset-2 hover:underline">
                        {monthLabel(m.month)}
                      </Link>
                    </TableCell>
                    <TableCell className="num text-right font-medium">
                      {m.delivered} <span className="text-xs font-normal text-muted-foreground">/ {target}</span>
                    </TableCell>
                    {recap.writers.map((a) => (
                      <TableCell key={a} className="num text-right">
                        {fmtN(m.content[a] ?? 0)}
                      </TableCell>
                    ))}
                    {recap.footage.map((a) => (
                      <TableCell key={a} className="num text-right">
                        {m.footage[a] ?? 0}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="num text-right">{recap.months.reduce((s, m) => s + m.delivered, 0)}</TableCell>
                  {recap.writers.map((a) => (
                    <TableCell key={a} className="num text-right">
                      {fmtN(recap.months.reduce((s, m) => s + (m.content[a] ?? 0), 0))}
                    </TableCell>
                  ))}
                  {recap.footage.map((a) => (
                    <TableCell key={a} className="num text-right">
                      {recap.months.reduce((s, m) => s + (m.footage[a] ?? 0), 0)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </Section>
        </>
      )}
    </div>
  );
}
