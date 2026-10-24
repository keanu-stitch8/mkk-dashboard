import { ChartCard } from "@/components/ChartCard";
import { Section, CompareTable, DataTable, KpiCard, KpiGrid, Notice } from "@/components/blocks";
import { BreakdownBars } from "@/components/charts";
import { Recommendations } from "@/components/Recommendations";
import { fmtDate, fmtDuration, fmtNum, fmtPct, truncate } from "@/lib/format";
import { monthLabel } from "@/lib/month";
import { WEBSITE_KPIS } from "@/lib/reports/kpi";
import type { WebsiteOverview } from "../types/website-overview";

export function WebsiteOverviewContent({ overview }: { overview: WebsiteOverview }) {
  const { month, summary: w, prev: p, trend: labels, recommendations: recs } = overview;

  return (
    <>
      {!w.hasGa4 && <Notice tone="warn">GA4 data for {monthLabel(month)} hasn&apos;t been imported — traffic metrics are empty.</Notice>}
      {w.hasGa4 && !w.hasPages && (
        <Notice tone="warn">
          GA4 <b>Pages and screens</b> hasn&apos;t been imported (CSV) — pageviews & top pages are empty, and News article views use the numbers from the report. Enter them manually on the Import page if needed.
        </Notice>
      )}
      {!w.hasGsc && <Notice tone="warn">Search Console data for {monthLabel(month)} hasn&apos;t been imported.</Notice>}

      <KpiGrid>
        {WEBSITE_KPIS.map((k) => {
          const cur = k.get(w);
          const value = k.kind === "rate" ? fmtPct(cur) : k.kind === "duration" ? fmtDuration(cur) : k.kind === "decimal" ? fmtNum(cur, 1) : fmtNum(cur);
          return (
            <KpiCard
              key={k.key}
              label={k.label}
              value={value}
              cur={cur}
              prev={p ? k.get(p) : null}
              kind={k.kind === "rate" ? "rate" : undefined}
              goodWhenUp={k.goodWhenUp}
              hint={k.hint}
              note={k.key === "users" && w.usersEstimated ? "Estimated from the sum per city" : undefined}
            />
          );
        })}
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Traffic trend" description="Users & sessions" data={labels} series={[{ key: "websiteUsers", name: "Users" }, { key: "websiteSessions", name: "Sessions" }]} />
        <ChartCard title="Google Search trend" description="Clicks & impressions" data={labels} series={[{ key: "gscImpressions", name: "Impressions" }, { key: "gscClicks", name: "Clicks" }]} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Traffic sources" subtitle="Sessions per channel (GA4 Traffic acquisition)">
          <BreakdownBars data={w.sourceBreakdown.map((s) => ({ label: s.label, value: s.sessions }))} name="Sessions" />
          <div className="mt-3">
            <DataTable
              rows={w.sourceBreakdown}
              columns={[
                { header: "Channel", cell: (r) => r.label },
                { header: "Sessions", align: "right", cell: (r) => fmtNum(r.sessions) },
                { header: "Share", align: "right", cell: (r) => fmtPct(r.share) },
                { header: "Eng. rate", align: "right", cell: (r) => fmtPct(r.engagementRate) },
                { header: "Avg eng.", align: "right", cell: (r) => fmtDuration(r.avgEngagementTime) },
              ]}
            />
          </div>
        </Section>
        <ChartCard title="Daily Google clicks" description={`Search Console · ${monthLabel(month)}`} data={w.gscDaily.map((d) => ({ label: fmtDate(d.date, false), clicks: d.clicks }))} series={[{ key: "clicks", name: "Clicks" }]} granularity="day" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top pages (GA4)" subtitle="By views">
          <DataTable
            rows={w.topPages.slice(0, 10)}
            empty="Import GA4 Pages and screens (CSV) to see top pages."
            columns={[
              { header: "#", cell: (_, i) => i + 1, className: "text-muted-foreground" },
              { header: "Page", cell: (r) => <span className="break-all">{truncate(r.title ?? r.path, 70)}</span> },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Users", align: "right", cell: (r) => fmtNum(r.activeUsers) },
              { header: "Avg eng.", align: "right", cell: (r) => fmtDuration(r.avgEngagementTime) },
            ]}
          />
        </Section>
        <Section title="Top landing pages (GA4)" subtitle="By sessions">
          <DataTable
            rows={w.topLanding}
            empty="Import GA4 Landing page (CSV)."
            columns={[
              { header: "#", cell: (_, i) => i + 1, className: "text-muted-foreground" },
              { header: "Landing page", cell: (r) => <span className="break-all">{truncate(r.path, 70)}</span> },
              { header: "Sessions", align: "right", cell: (r) => fmtNum(r.sessions) },
              { header: "New users", align: "right", cell: (r) => fmtNum(r.newUsers) },
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top queries (GSC)" subtitle="By clicks">
          <DataTable
            rows={w.topQueries.slice(0, 10)}
            empty="Import Search Console to see queries."
            columns={[
              { header: "Query", cell: (r) => r.query },
              { header: "Clicks", align: "right", cell: (r) => fmtNum(r.clicks) },
              { header: "Impr.", align: "right", cell: (r) => fmtNum(r.impressions) },
              { header: "CTR", align: "right", cell: (r) => fmtPct(r.ctr) },
              { header: "Position", align: "right", cell: (r) => fmtNum(r.position, 1) },
            ]}
          />
        </Section>
        <Section title="Opportunities: queries in positions 4–10" subtitle="Sorted by most impressions — aim to move into the top 3">
          <DataTable
            rows={w.opportunityQueries}
            empty="No queries in positions 4–10."
            columns={[
              { header: "Query", cell: (r) => r.query },
              { header: "Impr.", align: "right", cell: (r) => fmtNum(r.impressions) },
              { header: "Clicks", align: "right", cell: (r) => fmtNum(r.clicks) },
              { header: "Position", align: "right", cell: (r) => fmtNum(r.position, 1) },
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Top pages (GSC)" subtitle="By clicks" className="lg:col-span-2">
          <DataTable
            rows={w.gscTopPages.slice(0, 10)}
            columns={[
              { header: "Page", cell: (r) => <span className="break-all">{truncate(r.path, 60)}</span> },
              { header: "Clicks", align: "right", cell: (r) => fmtNum(r.clicks) },
              { header: "Impr.", align: "right", cell: (r) => fmtNum(r.impressions) },
              { header: "CTR", align: "right", cell: (r) => fmtPct(r.ctr) },
              { header: "Position", align: "right", cell: (r) => fmtNum(r.position, 1) },
            ]}
          />
        </Section>
        <Section title="Top cities" subtitle="Active users (GA4)">
          <BreakdownBars data={w.cities.slice(0, 8)} name="Active users" />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CompareTable
          month={month}
          hasPrev={!!p}
          rows={[
            { label: "Users", cur: w.users, prev: p?.users, fmt: fmtNum },
            { label: "New users", cur: w.newUsers, prev: p?.newUsers, fmt: fmtNum },
            { label: "Sessions", cur: w.sessions, prev: p?.sessions, fmt: fmtNum },
            { label: "Views", cur: w.pageviews, prev: p?.pageviews, fmt: fmtNum },
            { label: "Engagement rate", cur: w.engagementRate, prev: p?.engagementRate, fmt: (v) => fmtPct(v), kind: "rate" },
            { label: "Bounce rate", cur: w.bounceRate, prev: p?.bounceRate, fmt: (v) => fmtPct(v), kind: "rate", goodWhenUp: false },
            { label: "Avg engagement time", cur: w.avgEngagementTime, prev: p?.avgEngagementTime, fmt: fmtDuration },
            { label: "GSC clicks", cur: w.gscClicks, prev: p?.gscClicks, fmt: fmtNum },
            { label: "GSC impressions", cur: w.gscImpressions, prev: p?.gscImpressions, fmt: fmtNum },
            { label: "GSC CTR", cur: w.gscCtr, prev: p?.gscCtr, fmt: (v) => fmtPct(v), kind: "rate" },
            { label: "Avg position", cur: w.gscPosition, prev: p?.gscPosition, fmt: (v) => fmtNum(v, 1), goodWhenUp: false },
          ]}
        />
        <Recommendations items={recs} title="Website recommendations" showChannel={false} />
      </div>
    </>
  );
}
