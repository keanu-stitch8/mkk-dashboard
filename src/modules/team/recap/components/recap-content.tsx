import { PageHeader } from "@/components/PageHeader";
import { ChartCard } from "@/components/ChartCard";
import { KpiCard, KpiGrid, Section } from "@/components/blocks";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { monthLabel } from "@/modules/shared/lib/month";
import type { Recap } from "../types/recap";

const num = (v: number | null) => (v == null ? "—" : v.toLocaleString("id-ID"));
const compact = (v: number | null) => (v == null ? "—" : Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(v));

export function RecapContent({ data }: { data: Recap }) {
  const r = data;
  const { year } = r;
  const t = r.totals;
  const igPosts = t.feeds + t.reels + t.igStories;
  const followerGain = r.followers.start != null && r.followers.end != null ? r.followers.end - r.followers.start : null;
  const period = `${monthLabel(r.first)} – ${monthLabel(r.last)}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`MKK ${year} in numbers`} description={`What the content division delivered, ${period}. Counts come from the same logs and matches as the rest of the dashboard.`} />

      <KpiGrid cols={4}>
        <KpiCard label="Coverage guides" value={num(t.guides)} note={`${num(t.stories)} planned stories from Kudus${r.totals.teamSince ? ` since ${monthLabel(r.totals.teamSince)}` : ""}`} />
        <KpiCard label="Articles published" value={num(t.articles)} note="On mainkekudus.com (News Content Logs)" />
        <KpiCard label="Instagram posts" value={num(igPosts)} note={`${num(t.feeds)} feed · ${num(t.reels)} reels · ${num(t.igStories)} stories`} />
        <KpiCard label="Views across channels" value={compact(t.views)} note="Website pageviews + Instagram & Facebook views + YouTube views" hint="Views add up across months; unique reach doesn't, so it isn't summed here." />
      </KpiGrid>

      <KpiGrid cols={4}>
        <KpiCard label="Briefs" value={num(t.briefs)} note={`${num(t.carouselBriefs)} carousel · ${num(t.reelBriefs)} reel`} />
        <KpiCard
          label="Repurpose rate"
          value={t.repurposeBase ? `${Math.round((t.repurposed / t.repurposeBase) * 100)}%` : "—"}
          note={`${num(t.repurposed)} of ${num(t.repurposeBase)} articles got an Instagram derivative`}
          hint="Only counted links (confirmed, Story code, Task Progress, or strong title match). Locked months use their saved Team Scorecard."
        />
        <KpiCard label="Contributor stories" value={num(t.contributorStories)} note={`${num(t.assetsDelivered)} field assets delivered (photos & videos)`} />
        <KpiCard
          label="Instagram followers"
          value={num(r.followers.end)}
          note={followerGain == null ? "Not enough follower data yet" : `${followerGain >= 0 ? "+" : ""}${num(followerGain)} since ${monthLabel(r.first)}${r.followers.startEstimated ? " (start estimated)" : ""}`}
        />
      </KpiGrid>

      <ChartCard
        title="Output per month"
        description="Articles, briefs, and Instagram feed & reel posts"
        data={r.months.map((m) => ({ month: m.month, label: monthLabel(m.month, true), articles: m.articles, briefs: m.briefs, feeds: m.feeds, reels: m.reels }))}
        series={[
          { key: "articles", name: "Articles" },
          { key: "briefs", name: "Briefs" },
          { key: "feeds", name: "Feed posts" },
          { key: "reels", name: "Reels" },
        ]}
      />

      <Section title="Month by month" subtitle={r.websiteReaders != null ? `Website readers since launch: ${num(r.websiteReaders)} unique users (GA4).` : undefined}>
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Planned stories</TableHead>
              <TableHead className="text-right">Articles</TableHead>
              <TableHead className="text-right">Briefs</TableHead>
              <TableHead className="text-right">Feed</TableHead>
              <TableHead className="text-right">Reels</TableHead>
              <TableHead className="text-right">IG stories</TableHead>
              <TableHead className="text-right">YouTube videos</TableHead>
              <TableHead className="text-right">Repurpose rate</TableHead>
              <TableHead className="text-right">Views</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.months.map((m) => (
              <TableRow key={m.month}>
                <TableCell className="font-medium">{monthLabel(m.month)}</TableCell>
                <TableCell className="num text-right">{num(m.stories)}</TableCell>
                <TableCell className="num text-right">{num(m.articles)}</TableCell>
                <TableCell className="num text-right">{num(m.briefs)}</TableCell>
                <TableCell className="num text-right">{num(m.feeds)}</TableCell>
                <TableCell className="num text-right">{num(m.reels)}</TableCell>
                <TableCell className="num text-right">{num(m.igStories)}</TableCell>
                <TableCell className="num text-right">{num(m.youtube)}</TableCell>
                <TableCell className="num text-right">{m.repurpose == null ? "—" : `${Math.round(m.repurpose)}%`}</TableCell>
                <TableCell className="num text-right">{compact(m.views)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="num text-right">{num(t.stories)}</TableCell>
              <TableCell className="num text-right">{num(t.articles)}</TableCell>
              <TableCell className="num text-right">{num(t.briefs)}</TableCell>
              <TableCell className="num text-right">{num(t.feeds)}</TableCell>
              <TableCell className="num text-right">{num(t.reels)}</TableCell>
              <TableCell className="num text-right">{num(t.igStories)}</TableCell>
              <TableCell className="num text-right">{num(t.youtube)}</TableCell>
              <TableCell className="num text-right">{t.repurposeBase ? `${Math.round((t.repurposed / t.repurposeBase) * 100)}%` : "—"}</TableCell>
              <TableCell className="num text-right">{compact(t.views)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Section>
    </div>
  );
}
