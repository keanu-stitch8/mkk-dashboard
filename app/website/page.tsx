import { PageHeader } from "@/components/PageHeader";
import { Section, CompareTable, DataTable, EmptyState, KpiCard, KpiGrid, Notice } from "@/components/blocks";
import { BreakdownBars, TrendChart } from "@/components/charts";
import { Recommendations } from "@/components/Recommendations";
import { getMonthAndPrev, getTrend, resolveMonth } from "@/lib/data/summary";
import { generateRecommendations } from "@/lib/recommendations";
import { fmtDate, fmtDuration, fmtNum, fmtPct, truncate } from "@/lib/format";
import { monthLabel } from "@/lib/month";
import { WEBSITE_KPIS } from "@/lib/reports/kpi";

export const dynamic = "force-dynamic";

export default async function WebsitePage({ searchParams }: PageProps<"/website">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const [{ cur, prev }, trend] = await Promise.all([getMonthAndPrev(month), getTrend(month)]);
  const w = cur.website;
  const p = prev.website.hasData ? prev.website : null;
  const recs = generateRecommendations({ cur, prev }).filter((r) => r.channel === "website");
  const labels = trend.map((t) => ({ ...t, label: monthLabel(t.month, true) }));

  if (!w.hasData) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Website" month={month} months={months} />
        <EmptyState channel="Website" month={month} source="GA4 / Search Console" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="Website" description="mainkekudus.com · GA4 + Google Search Console" month={month} months={months} />

      {!w.hasGa4 && <Notice tone="warn">Data GA4 {monthLabel(month)} belum di-import — metrik traffic kosong.</Notice>}
      {w.hasGa4 && !w.hasPages && (
        <Notice tone="warn">
          GA4 <b>Pages and screens</b> belum di-import (CSV) — pageviews & top pages kosong, dan views artikel News memakai angka dari report. Isi manual di halaman Import jika perlu.
        </Notice>
      )}
      {!w.hasGsc && <Notice tone="warn">Data Search Console {monthLabel(month)} belum di-import.</Notice>}

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
              note={k.key === "users" && w.usersEstimated ? "Estimasi dari jumlah per kota" : undefined}
            />
          );
        })}
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Tren traffic" subtitle="Users & sessions · 6 bulan">
          <TrendChart data={labels} series={[{ key: "websiteUsers", name: "Users" }, { key: "websiteSessions", name: "Sessions" }]} />
        </Section>
        <Section title="Tren Google Search" subtitle="Clicks & impressions · 6 bulan">
          <TrendChart data={labels} series={[{ key: "gscImpressions", name: "Impressions" }, { key: "gscClicks", name: "Clicks" }]} />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Sumber traffic" subtitle="Sessions per channel (GA4 Traffic acquisition)">
          <BreakdownBars data={w.sourceBreakdown.map((s) => ({ label: s.label, value: s.sessions }))} name="Sessions" />
          <div className="mt-3">
            <DataTable
              rows={w.sourceBreakdown}
              columns={[
                { header: "Channel", cell: (r) => r.label },
                { header: "Sessions", align: "right", cell: (r) => fmtNum(r.sessions) },
                { header: "Porsi", align: "right", cell: (r) => fmtPct(r.share) },
                { header: "Eng. rate", align: "right", cell: (r) => fmtPct(r.engagementRate) },
                { header: "Avg eng.", align: "right", cell: (r) => fmtDuration(r.avgEngagementTime) },
              ]}
            />
          </div>
        </Section>
        <Section title="Klik Google harian" subtitle={`Search Console · ${monthLabel(month)}`}>
          <TrendChart data={w.gscDaily.map((d) => ({ label: fmtDate(d.date, false), clicks: d.clicks }))} series={[{ key: "clicks", name: "Clicks" }]} type="bar" height={240} />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Top pages (GA4)" subtitle="Berdasarkan views">
          <DataTable
            rows={w.topPages}
            empty="Import GA4 Pages and screens (CSV) untuk melihat top pages."
            columns={[
              { header: "#", cell: (_, i) => i + 1, className: "text-muted-foreground" },
              { header: "Halaman", cell: (r) => <span className="break-all">{truncate(r.title ?? r.path, 70)}</span> },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Users", align: "right", cell: (r) => fmtNum(r.activeUsers) },
              { header: "Avg eng.", align: "right", cell: (r) => fmtDuration(r.avgEngagementTime) },
            ]}
          />
        </Section>
        <Section title="Top landing pages (GA4)" subtitle="Berdasarkan sessions">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Top queries (GSC)" subtitle="Berdasarkan clicks">
          <DataTable
            rows={w.topQueries}
            empty="Import Search Console untuk melihat query."
            columns={[
              { header: "Query", cell: (r) => r.query },
              { header: "Clicks", align: "right", cell: (r) => fmtNum(r.clicks) },
              { header: "Impr.", align: "right", cell: (r) => fmtNum(r.impressions) },
              { header: "CTR", align: "right", cell: (r) => fmtPct(r.ctr) },
              { header: "Posisi", align: "right", cell: (r) => fmtNum(r.position, 1) },
            ]}
          />
        </Section>
        <Section title="Peluang: query posisi 4–10" subtitle="Diurutkan dari impressions terbanyak — target naik ke top 3">
          <DataTable
            rows={w.opportunityQueries}
            empty="Tidak ada query di posisi 4–10."
            columns={[
              { header: "Query", cell: (r) => r.query },
              { header: "Impr.", align: "right", cell: (r) => fmtNum(r.impressions) },
              { header: "Clicks", align: "right", cell: (r) => fmtNum(r.clicks) },
              { header: "Posisi", align: "right", cell: (r) => fmtNum(r.position, 1) },
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Top pages (GSC)" subtitle="Berdasarkan clicks" className="lg:col-span-2">
          <DataTable
            rows={w.gscTopPages.slice(0, 10)}
            columns={[
              { header: "Halaman", cell: (r) => <span className="break-all">{truncate(r.path, 60)}</span> },
              { header: "Clicks", align: "right", cell: (r) => fmtNum(r.clicks) },
              { header: "Impr.", align: "right", cell: (r) => fmtNum(r.impressions) },
              { header: "CTR", align: "right", cell: (r) => fmtPct(r.ctr) },
              { header: "Posisi", align: "right", cell: (r) => fmtNum(r.position, 1) },
            ]}
          />
        </Section>
        <Section title="Kota teratas" subtitle="Active users (GA4)">
          <BreakdownBars data={w.cities.slice(0, 8)} name="Active users" />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
        <Recommendations items={recs} title="Rekomendasi website" showChannel={false} />
      </div>
    </div>
  );
}
