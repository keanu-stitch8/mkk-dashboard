import { ChartCard } from "@/components/ChartCard";
import { Section, CompareTable, DataTable, KpiCard, KpiGrid, Notice, QuotaHero, StatusBadge } from "@/components/blocks";
import { BreakdownBars } from "@/components/charts";
import { Recommendations } from "@/components/Recommendations";
import { fmtDate, fmtDuration, fmtNum, fmtPct, truncate } from "@/modules/shared/lib/format";
import { monthLabel } from "@/modules/shared/lib/month";
import { NEWS_KPIS } from "@/modules/report/pipeline/kpi";
import type { NewsOverview } from "../types/news-overview";

export function NewsOverviewContent({ overview }: { overview: NewsOverview }) {
  const { month, summary: n, prev: p, quota, prevQuota, trend: labels, recommendations: recs } = overview;
  const publishedCount = n.articles.filter((a) => a.status === "publish").length;

  return (
    <>
      {n.viewsSource === "report" && (
        <Notice>Per-article views use the numbers from the News report (Article Performance sheet). Import this month&apos;s GA4 Pages and screens (CSV) to match directly against GA4.</Notice>
      )}
      {n.viewsSource === null && <Notice tone="warn">No views data (GA4 Pages and screens) for {monthLabel(month)} yet — article views are empty.</Notice>}

      {/* 1. Kuota tercapai + produksi vs kuota */}
      <div className="grid gap-6 lg:grid-cols-3">
        <QuotaHero q={quota} prev={prevQuota} month={month} />
        <ChartCard title="Delivered vs quota" description="Articles per month · delivered = published + in review" className="lg:col-span-2"
            data={labels}
            series={[
              { key: "newsPublished", name: "Published" },
              { key: "newsDelivered", name: "Delivered (+ review)" },
              { key: "newsQuota", name: "Quota", reference: true },
            ]} />
      </div>

      {/* 2. KPI — definisi bersama dengan kartu KPI laporan Google Sheets (modules/report/pipeline/kpi.ts) */}
      <KpiGrid cols={4}>
        {NEWS_KPIS.map((k) => {
          const cur = k.get(n);
          const value = k.display?.(n) ?? (k.kind === "rate" ? fmtPct(cur) : k.kind === "duration" ? fmtDuration(cur) : k.kind === "decimal" ? fmtNum(cur, 1) : fmtNum(cur));
          const note =
            k.key === "published"
              ? `${fmtNum(n.activeDays)} active days · longest gap ${fmtNum(n.emptyStreak.length)} days`
              : k.key === "views"
                ? `${fmtNum(n.matchedCount)}/${fmtNum(publishedCount)} URLs matched in GA4${n.unmatched.length ? ` · ${n.unmatched.length} unmatched` : ""}${n.pendingViews.length ? ` · ${n.pendingViews.length} awaiting GA4 data` : ""}`
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
        <ChartCard title="Views" data={labels} series={[{ key: "newsViews", name: "Views" }]} />
        <ChartCard title="Daily · articles published" description={`${fmtNum(n.activeDays)} active days · ${monthLabel(month)}`} data={n.daily.map((d) => ({ label: fmtDate(d.date, false), count: d.count }))} series={[{ key: "count", name: "Articles" }]} granularity="day" />
      </div>

      {/* 4. Breakdown + top konten */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="By category" subtitle="Views per article">
          <BreakdownBars data={n.byCategory.map((c) => ({ label: c.label, value: c.perContent }))} name="Views/article" />
          <DataTable
            rows={n.byCategory}
            columns={[
              { header: "Category", cell: (r) => r.label },
              { header: "Articles", align: "right", cell: (r) => fmtNum(r.count) },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
            ]}
          />
        </Section>
        <Section title="Top articles" subtitle="By views" className="lg:col-span-2">
          <DataTable
            rows={n.topArticles}
            empty="No views data yet."
            columns={[
              { header: "#", cell: (_, i) => i + 1, className: "text-muted-foreground" },
              {
                header: "Title",
                cell: (r) =>
                  r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                      {truncate(r.title, 70)}
                    </a>
                  ) : (
                    truncate(r.title, 70)
                  ),
              },
              { header: "Date", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span> },
              { header: "Category", cell: (r) => r.category ?? "—" },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Avg eng.", align: "right", cell: (r) => fmtDuration(r.avgEngagementTime) },
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="By reporter" subtitle="Articles with more than one reporter count toward each reporter">
          <DataTable
            rows={n.byReporter}
            columns={[
              { header: "Reporter", cell: (r) => r.label },
              { header: "Articles", align: "right", cell: (r) => fmtNum(r.count) },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Views/art.", align: "right", cell: (r) => fmtNum(r.perContent) },
            ]}
          />
        </Section>
        <Section title="By format" subtitle="Hard News / Features / Editorial">
          <BreakdownBars data={n.byType.map((c) => ({ label: c.label, value: c.perContent }))} name="Views/article" />
          <DataTable
            rows={n.byType}
            columns={[
              { header: "Format", cell: (r) => r.label },
              { header: "Articles", align: "right", cell: (r) => fmtNum(r.count) },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
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
            { label: "Published", cur: n.published, prev: p?.published, fmt: fmtNum },
            { label: "Quota achieved", cur: quota.rate, prev: prevQuota?.rate, fmt: (v) => fmtPct(v), kind: "rate" },
            { label: "Views", cur: n.totalViews, prev: p?.totalViews, fmt: fmtNum },
            { label: "Views / article", cur: n.viewsPerArticle, prev: p?.viewsPerArticle, fmt: fmtNum },
            { label: "Readers", cur: n.readers, prev: p?.readers, fmt: fmtNum },
            { label: "Avg engagement", cur: n.avgEngagementTime, prev: p?.avgEngagementTime, fmt: fmtDuration },
            { label: "In review", cur: n.inReview, prev: p?.inReview, fmt: fmtNum, neutral: true },
            { label: "Active publishing days", cur: n.activeDays, prev: p?.activeDays, fmt: fmtNum },
          ]}
        />
        <Recommendations items={recs} title="News recommendations" showChannel={false} />
      </div>

      {(n.unmatched.length > 0 || n.zeroViews.length > 0 || n.pendingViews.length > 0) && (
        <Section
          title="Needs review"
          subtitle={`Published articles that don't match the views data, or have 0 views${n.pendingViews.length ? " · awaiting GA4 data = just published, GA4 needs ~48 hours" : ""}`}
        >
          <DataTable
            rows={[...n.unmatched, ...n.zeroViews, ...n.pendingViews]}
            columns={[
              { header: "Title", cell: (r) => truncate(r.title, 70) },
              { header: "URL", cell: (r) => <span className="break-all text-muted-foreground">{r.path ?? "(no URL)"}</span> },
              {
                header: "Issue",
                cell: (r) =>
                  n.pendingViews.includes(r) ? (
                    <StatusBadge tone="neutral">Awaiting GA4 data</StatusBadge>
                  ) : (
                    <StatusBadge tone="warn">{r.matched ? "0 views" : "Unmatched"}</StatusBadge>
                  ),
              },
            ]}
          />
        </Section>
      )}
    </>
  );
}
