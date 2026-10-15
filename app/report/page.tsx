import Link from "next/link";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/PrintButton";
import { MonthSelect } from "@/components/MonthSelect";
import { Recommendations } from "@/components/Recommendations";
import { ArrowLeft } from "lucide-react";
import { DeltaBadge } from "@/components/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contentQuota, getMonthAndPrev, overviewComparison, overviewKpis, resolveMonth, socialComparable } from "@/lib/data/summary";
import { generateRecommendations } from "@/lib/recommendations";
import { DASH, fmtDuration, fmtNum, fmtPct, truncate } from "@/lib/format";
import { monthLabel, prevMonth } from "@/lib/month";
import { FORMAT_LABEL, PLATFORM_LABEL } from "@/lib/sources";

export const dynamic = "force-dynamic";

type Row = [label: string, cur: number | null | undefined, prev: number | null | undefined, fmt: (v: number | null | undefined) => string, opts?: { rate?: boolean; down?: boolean }];

function MetricTable({ rows, month }: { rows: Row[]; month: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metrik</TableHead>
          <TableHead className="text-right">{monthLabel(month, true)}</TableHead>
          <TableHead className="text-right">{monthLabel(prevMonth(month), true)}</TableHead>
          <TableHead className="text-right">MoM</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([label, cur, prev, fmt, o]) => (
          <TableRow key={label}>
            <TableCell className="text-muted-foreground">{label}</TableCell>
            <TableCell className="num text-right font-medium">{fmt(cur)}</TableCell>
            <TableCell className="num text-right text-muted-foreground">{fmt(prev)}</TableCell>
            <TableCell className="text-right">
              {cur != null && prev != null ? <DeltaBadge cur={cur} prev={prev} kind={o?.rate ? "rate" : "count"} goodWhenUp={!o?.down} /> : <span className="text-xs text-muted-foreground">{DASH}</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ReportSection({ title, children, empty }: { title: string; children: ReactNode; empty?: boolean }) {
  return (
    <Card className="avoid-break">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{empty ? <p className="text-sm text-muted-foreground">Belum ada data untuk bulan ini.</p> : children}</CardContent>
    </Card>
  );
}

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const { cur, prev } = await getMonthAndPrev(month);
  const kpi = overviewKpis(cur);
  const cmp = overviewComparison(cur, prev);
  const recs = generateRecommendations({ cur, prev });
  const { website: w, news: n, youtube: y, social: s } = cur;
  const pw = prev.website.hasData ? prev.website : null;
  const pn = prev.news.hasData ? prev.news : null;
  const py = prev.youtube.hasData ? prev.youtube : null;
  const sc = socialComparable(cur.social, prev.social);
  const qn = contentQuota(cur, "news");
  const qy = contentQuota(cur, "youtube");
  const qs = contentQuota(cur, "social");
  const pqn = prev.news.hasData ? contentQuota(prev, "news") : null;
  const pqy = prev.youtube.hasData ? contentQuota(prev, "youtube") : null;
  const pqs = prev.social.hasData ? contentQuota(prev, "social") : null;
  const quotaLabel = (q: typeof qn) => `Kuota tercapai (${q.achievedLabel.toLowerCase()} ${q.available ? fmtNum(q.achieved) : "—"}/${fmtNum(q.target)} ${q.unit})`;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/?m=${month}`}>
            <ArrowLeft /> Kembali ke dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <MonthSelect month={month} months={months} />
          <PrintButton />
        </div>
      </div>

      <header className="border-b pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Main ke Kudus · Laporan bulanan</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{monthLabel(month)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Website, News, YouTube & Social Media · dibandingkan dengan {monthLabel(prevMonth(month))}</p>
      </header>

      <ReportSection title="Ringkasan lintas channel">
        <MetricTable
          month={month}
          rows={[
            ["Total reach / impressions", kpi.totalReach, cmp.totalReach && !cmp.totalReach.partial ? cmp.totalReach.prev : null, fmtNum],
            ["Total engagement", kpi.totalEngagement, cmp.totalEngagement && !cmp.totalEngagement.partial ? cmp.totalEngagement.prev : null, fmtNum],
            ["Website users", kpi.websiteUsers, cmp.websiteUsers?.[1], fmtNum],
            ["YouTube views", kpi.youtubeViews, cmp.youtubeViews?.[1], fmtNum],
            [`News — ${quotaLabel(qn)}`, qn.available ? qn.rate : null, pqn?.available ? pqn.rate : null, (v) => fmtPct(v), { rate: true }],
            [`YouTube — ${quotaLabel(qy)}`, qy.available ? qy.rate : null, pqy?.available ? pqy.rate : null, (v) => fmtPct(v), { rate: true }],
            [`Social — ${quotaLabel(qs)}`, qs.available ? qs.rate : null, pqs?.available ? pqs.rate : null, (v) => fmtPct(v), { rate: true }],
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Reach/impressions = impressions Google Search + impressions YouTube + reach sosmed. Engagement = interaksi sosmed + engaged sessions website. MoM gabungan hanya ditampilkan jika semua komponennya punya data di kedua bulan.
        </p>
      </ReportSection>

      <ReportSection title="Website" empty={!w.hasData}>
        <MetricTable
          month={month}
          rows={[
            ["Users", w.users, pw?.users, fmtNum],
            ["Sessions", w.sessions, pw?.sessions, fmtNum],
            ["Views", w.pageviews, pw?.pageviews, fmtNum],
            ["Engagement rate", w.engagementRate, pw?.engagementRate, (v) => fmtPct(v), { rate: true }],
            ["Avg engagement time", w.avgEngagementTime, pw?.avgEngagementTime, fmtDuration],
            ["GSC clicks", w.gscClicks, pw?.gscClicks, fmtNum],
            ["GSC impressions", w.gscImpressions, pw?.gscImpressions, fmtNum],
            ["GSC CTR", w.gscCtr, pw?.gscCtr, (v) => fmtPct(v), { rate: true }],
            ["Avg position", w.gscPosition, pw?.gscPosition, (v) => fmtNum(v, 1), { down: true }],
          ]}
        />
        {w.sourceBreakdown.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            <b className="font-medium text-foreground">Sumber traffic:</b> {w.sourceBreakdown.slice(0, 4).map((x) => `${x.label} ${fmtPct(x.share)}`).join(" · ")}
          </p>
        )}
        {w.topQueries.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            <b className="font-medium text-foreground">Top query:</b> {w.topQueries.slice(0, 5).map((q) => `${q.query} (${fmtNum(q.clicks)})`).join(" · ")}
          </p>
        )}
      </ReportSection>

      <ReportSection title="News" empty={!n.hasData}>
        <MetricTable
          month={month}
          rows={[
            [quotaLabel(qn), qn.rate, pqn?.rate, (v) => fmtPct(v), { rate: true }],
            ["Artikel published", n.published, pn?.published, fmtNum],
            ["Artikel in review", n.inReview, pn?.inReview, fmtNum, { down: true }],
            ["Delivered (publish + review)", n.achievement, pn?.achievement, (v) => fmtPct(v), { rate: true }],
            ["Total views", n.totalViews, pn?.totalViews, fmtNum],
            ["Views per artikel", n.viewsPerArticle, pn?.viewsPerArticle, fmtNum],
          ]}
        />
        {n.topArticles.length > 0 && (
          <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-sm text-muted-foreground">
            {n.topArticles.slice(0, 5).map((a) => (
              <li key={a.id}>
                {truncate(a.title, 90)} — <span className="num">{fmtNum(a.views)} views</span>
              </li>
            ))}
          </ol>
        )}
      </ReportSection>

      <ReportSection title="YouTube" empty={!y.hasData}>
        <p className="mb-2 text-xs text-muted-foreground">Video yang dipublish {monthLabel(month)}, performa selama {monthLabel(month)}.</p>
        <MetricTable
          month={month}
          rows={[
            ["Views", y.views, py?.views, fmtNum],
            ["Watch time (jam)", y.watchHours, py?.watchHours, (v) => fmtNum(v, 1)],
            ["Subscribers net", y.subsNet, py?.subsNet, fmtNum],
            ["Impressions", y.impressions, py?.impressions, fmtNum],
            ["Impressions CTR", y.ctr, py?.ctr, (v) => fmtPct(v, 2), { rate: true }],
            ["Avg view duration", y.avgViewDurationSec, py?.avgViewDurationSec, fmtDuration],
            [quotaLabel(qy), qy.rate, pqy?.rate, (v) => fmtPct(v), { rate: true }],
          ]}
        />
        {y.topVideos[0] && (
          <p className="mt-3 text-sm text-muted-foreground">
            <b className="font-medium text-foreground">Top video:</b> {truncate(y.topVideos[0].title, 80)} — {fmtNum(y.topVideos[0].views)} views ({fmtPct(y.topVideos[0].shareOfViews)} dari total)
          </p>
        )}
      </ReportSection>

      <ReportSection title="Social media" empty={!s.hasData}>
        <p className="mb-2 text-xs text-muted-foreground">
          Platform: {s.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(", ") || DASH}
          {sc ? ` · MoM untuk ${sc.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(", ")}` : prev.social.hasData ? " · MoM tidak dihitung (platform bulan lalu berbeda)" : ""}
        </p>
        <MetricTable
          month={month}
          rows={[
            [quotaLabel(qs), qs.available ? qs.rate : null, pqs?.available ? pqs.rate : null, (v) => fmtPct(v), { rate: true }],
            ["Posts published (total)", s.postsPublished, sc?.prev.posts, fmtNum],
            ["Hari aktif publish", s.activeDays, null, fmtNum],
            ["Total reach", s.reach, sc?.prev.reach, fmtNum],
            ["Total views", s.views, sc?.prev.views, fmtNum],
            ["Total interactions", s.interactions, sc?.prev.interactions, fmtNum],
            ["Engagement rate", s.engagementRate, sc?.prev.engagementRate, (v) => fmtPct(v, 2), { rate: true }],
          ]}
        />
        {s.byFormat.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            <b className="font-medium text-foreground">Per format (reach/post):</b>{" "}
            {s.byFormat.map((f) => `${PLATFORM_LABEL[f.platform] ?? f.platform} ${FORMAT_LABEL[f.format] ?? f.format} ${fmtNum(f.avgReach)}`).join(" · ")}
          </p>
        )}
      </ReportSection>

      <div className="print-break" />
      <Recommendations items={recs} note={`Rekomendasi otomatis untuk ${monthLabel(month)}`} />
      <p className="pb-6 text-center text-xs text-muted-foreground">Dibuat dari dashboard MKK Analytics · {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
    </div>
  );
}
