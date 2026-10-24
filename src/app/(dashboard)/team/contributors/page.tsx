import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard, KpiGrid, Section } from "@/components/blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BADGE } from "@/components/log-badges";
import { contributorMonths, getContributors, type ContributorItem } from "@/lib/data/contributors";
import { median, teamMonths } from "@/lib/data/team";
import { ASSETS, type AssetCell } from "@/lib/team/contributors";
import { currentMonth, isMonth, monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const FILTERS = {
  all: "All",
  incomplete: "Incomplete assets",
  reel: "Reel-ready",
  none: "Nothing reported",
} as const;
type Filter = keyof typeof FILTERS;

const match = (f: Filter, it: ContributorItem) => (f === "incomplete" ? it.reported && !it.complete : f === "reel" ? it.reelReady : f === "none" ? !it.reported : true);
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

export default async function ContributorsPage({ searchParams }: PageProps<"/team/contributors">) {
  const sp = await searchParams;
  const [withData, team] = await Promise.all([contributorMonths(), teamMonths()]);
  const months = [...new Set([...withData, ...team])].sort().reverse();
  const month = isMonth(sp.m) ? sp.m : (withData[0] ?? months[0] ?? currentMonth());
  const show: Filter = typeof sp.show === "string" && sp.show in FILTERS ? (sp.show as Filter) : "all";
  const { items, people, nameOf } = await getContributors(month);

  const complete = items.filter((i) => i.complete).length;
  const reported = items.filter((i) => i.reported).length;
  const reel = items.filter((i) => i.reelReady).length;
  const lag = median(items.map((i) => i.assetLag).filter((x): x is number => x != null && x >= 0));
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
            <KpiCard label="Planned stories" value={String(items.length)} note={`${reported} with assets reported · ${items.filter((i) => i.storyCode).length} linked to a coverage guide`} />
            <KpiCard
              label="Complete assets"
              value={`${Math.round((complete / items.length) * 100)}%`}
              note={`${complete} of ${items.length} stories`}
              hint="Complete = a photo (landscape or portrait) + portrait video + interview video, all marked Available."
            />
            <KpiCard label="Reel-ready" value={String(reel)} note="Portrait video available" />
            <KpiCard label="Planned → last asset" value={lag == null ? "—" : `${lag} day${lag === 1 ? "" : "s"}`} note="Median days until the last asset arrived" />
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
                        <div className="font-medium">{it.title}</div>
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
                            <span className="text-xs text-muted-foreground">{[it.articleBy && (nameOf[it.articleBy.toUpperCase()] ?? it.articleBy), it.articleAt && fmtShort(it.articleAt)].filter(Boolean).join(" · ")}</span>
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

          <Section title="By contributor" subtitle="Articles and assets marked Available this month, by the alias in the sheet.">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>Contributor</TableHead>
                  <TableHead className="w-28 text-right">Articles</TableHead>
                  <TableHead className="w-28 text-right">Assets</TableHead>
                  <TableHead className="w-40 text-right">Planned → asset</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((p) => (
                  <TableRow key={p.alias}>
                    <TableCell>
                      {p.name ?? p.alias} <span className="ml-1 font-mono text-xs text-muted-foreground">{p.alias}</span>
                    </TableCell>
                    <TableCell className="num text-right">{p.articles}</TableCell>
                    <TableCell className="num text-right">{p.assets}</TableCell>
                    <TableCell className="num text-right text-muted-foreground">{p.lag == null ? "—" : `${p.lag} days (median)`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </>
      )}
    </div>
  );
}
