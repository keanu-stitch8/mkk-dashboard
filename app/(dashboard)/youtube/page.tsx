import { PageHeader } from "@/components/PageHeader";
import { ChartCard } from "@/components/ChartCard";
import { Section, CompareTable, DataTable, EmptyState, KpiCard, KpiGrid, Notice, QuotaHero } from "@/components/blocks";
import { BreakdownBars } from "@/components/charts";
import { Recommendations } from "@/components/Recommendations";
import { contentQuota, getMonthAndPrev, getTrend, resolveMonth } from "@/lib/data/summary";
import { generateRecommendations } from "@/lib/recommendations";
import { fmtDate, fmtDuration, fmtNum, fmtPct, truncate } from "@/lib/format";
import { monthLabel } from "@/lib/month";
import { YOUTUBE_KPIS } from "@/lib/reports/kpi";

export const dynamic = "force-dynamic";

export default async function YoutubePage({ searchParams }: PageProps<"/youtube">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const [{ cur, prev }, trend] = await Promise.all([getMonthAndPrev(month), getTrend(month)]);
  const y = cur.youtube;
  const p = prev.youtube.hasData ? prev.youtube : null;
  const quota = contentQuota(cur, "youtube");
  const prevQuota = p ? contentQuota(prev, "youtube") : null;
  const recs = generateRecommendations({ cur, prev }).filter((r) => r.channel === "youtube");
  const labels = trend.map((t) => ({ ...t, label: monthLabel(t.month, true) }));

  if (!y.hasData) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="YouTube" month={month} months={months} />
        <EmptyState channel="YouTube" month={month} source="YouTube Studio" />
      </div>
    );
  }

  const vpv = y.viewsPerVideo;
  const prevVpv = p ? p.viewsPerVideo : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="YouTube" description={`Videos published in ${monthLabel(month)} · performance during ${monthLabel(month)}`} month={month} months={months} />
      <Notice>
        Report definition: every number on this page comes only from videos <b>published in {monthLabel(month)}</b>, with the views/watch time that happened during {monthLabel(month)} (same as the News report).
      </Notice>

      {/* 1. Kuota tercapai + produksi vs kuota */}
      <div className="grid gap-6 lg:grid-cols-3">
        <QuotaHero q={quota} prev={prevQuota} month={month} />
        <ChartCard title="Delivered vs quota" description="Videos per month · delivered = published + in review" className="lg:col-span-2"
            data={labels}
            series={[
              { key: "ytPublished", name: "Published" },
              { key: "ytDelivered", name: "Delivered (+ review)" },
              { key: "ytQuota", name: "Quota", reference: true },
            ]} />
      </div>

      {/* 2. KPI — definisi bersama dengan kartu KPI laporan Google Sheets (lib/reports/kpi.ts) */}
      <KpiGrid cols={4}>
        {YOUTUBE_KPIS.map((k) => {
          const cur = k.get(y);
          const value =
            k.key === "watch_hours"
              ? `${fmtNum(cur, 1)} hrs`
              : (k.display?.(y) ?? (k.kind === "rate" ? fmtPct(cur, 2) : k.kind === "duration" ? fmtDuration(cur) : k.kind === "decimal" ? fmtNum(cur, 1) : fmtNum(cur))) ?? "—";
          const note =
            k.key === "subs_net"
              ? y.hasSubsLost
                ? `+${fmtNum(y.subsGained)} / −${fmtNum(y.subsLost)}`
                : "No subscribers-lost data"
              : k.key === "delivered"
                ? `${fmtNum(y.published)} published + ${fmtNum(y.inReview)} in review`
                : undefined;
          return (
            <KpiCard
              key={k.key}
              label={k.label}
              value={value}
              cur={cur}
              prev={p ? k.get(p) : null}
              kind={k.kind === "rate" ? "rate" : undefined}
              goodWhenUp={k.goodWhenUp}
              neutral={k.neutral}
              hint={k.hint}
              note={note}
            />
          );
        })}
      </KpiGrid>

      {/* 3. Performa & aktivitas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Views" data={labels} series={[{ key: "ytViews", name: "Views" }]} />
        {y.daily.length ? (
          <ChartCard
            title="Daily · watch time (hours)"
            description={monthLabel(month)}
            data={y.daily.map((d) => ({ label: fmtDate(d.date, false), wh: d.watchHours }))}
            series={[{ key: "wh", name: "Watch time" }]}
            format="hours"
            granularity="day"
          />
        ) : (
          <Section title="Daily · watch time (hours)" subtitle={monthLabel(month)}>
            <p className="py-8 text-center text-sm text-muted-foreground">
              No daily data yet. Export from YouTube Studio with the <b>Watch time (hours)</b> chart metric, then upload Totals.csv.
            </p>
          </Section>
        )}
      </div>

      {/* 4. Breakdown + top konten */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="By category" subtitle="Views per video · category from the publishing log">
          {y.byCategory.length > 0 && <BreakdownBars data={y.byCategory.map((c) => ({ label: c.label, value: c.perContent }))} name="Views/video" />}
          <DataTable
            rows={y.byCategory}
            empty="Import the YouTube publishing log to see categories."
            columns={[
              { header: "Category", cell: (r) => r.label },
              { header: "Video", align: "right", cell: (r) => fmtNum(r.count) },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
            ]}
          />
        </Section>
        <Section title="Top videos" subtitle="By views" className="lg:col-span-2">
          <DataTable
            rows={y.topVideos}
            columns={[
              { header: "#", cell: (_, i) => i + 1, className: "text-muted-foreground" },
              {
                header: "Video",
                cell: (r) => (
                  <a href={`https://www.youtube.com/watch?v=${r.videoId}`} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                    {truncate(r.title, 60)}
                  </a>
                ),
              },
              { header: "Publish", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.publishedDate)}</span> },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Watch (hrs)", align: "right", cell: (r) => fmtNum(r.watchHours, 1) },
              { header: "AVD", align: "right", cell: (r) => fmtDuration(r.avgViewDurationSec) },
              { header: "Impr.", align: "right", cell: (r) => fmtNum(r.impressions) },
              { header: "CTR", align: "right", cell: (r) => <span className={r.ctr != null && r.ctr < 0.04 ? "font-medium text-danger" : ""}>{fmtPct(r.ctr, 2)}</span> },
              { header: "Subs", align: "right", cell: (r) => fmtNum(r.subsGained) },
            ]}
          />
        </Section>
      </div>

      {/* 5. Bulan ini vs bulan lalu + rekomendasi */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CompareTable
          month={month}
          hasPrev={!!p}
          rows={[
            { label: "Published", cur: y.published, prev: p?.published, fmt: fmtNum },
            { label: "Quota achieved", cur: quota.rate, prev: prevQuota?.rate, fmt: (v) => fmtPct(v), kind: "rate" },
            { label: "Views", cur: y.views, prev: p?.views, fmt: fmtNum },
            { label: "Views / video", cur: vpv, prev: prevVpv, fmt: fmtNum },
            { label: "Impressions", cur: y.impressions, prev: p?.impressions, fmt: fmtNum },
            { label: "Impressions CTR", cur: y.ctr, prev: p?.ctr, fmt: (v) => fmtPct(v, 2), kind: "rate" },
            { label: "Watch time (hours)", cur: y.watchHours, prev: p?.watchHours, fmt: (v) => fmtNum(v, 1) },
            { label: "Avg view duration", cur: y.avgViewDurationSec, prev: p?.avgViewDurationSec, fmt: fmtDuration },
            { label: "Subscribers net", cur: y.subsNet, prev: p?.subsNet, fmt: fmtNum },
          ]}
        />
        <Recommendations items={recs} title="YouTube recommendations" showChannel={false} />
      </div>
    </div>
  );
}
