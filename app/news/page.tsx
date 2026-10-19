import { PageHeader } from "@/components/PageHeader";
import { Section, CompareTable, DataTable, EmptyState, KpiCard, KpiGrid, Notice, QuotaHero, StatusBadge } from "@/components/blocks";
import { BreakdownBars, TrendChart } from "@/components/charts";
import { Recommendations } from "@/components/Recommendations";
import { contentQuota, getMonthAndPrev, getTrend, resolveMonth } from "@/lib/data/summary";
import { generateRecommendations } from "@/lib/recommendations";
import { fmtDate, fmtDuration, fmtNum, fmtPct, truncate } from "@/lib/format";
import { monthLabel } from "@/lib/month";
import { NEWS_KPIS } from "@/lib/reports/kpi";

export const dynamic = "force-dynamic";

const STATUS_TONE = { publish: "good", review: "warn", draft: "neutral" } as const;

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const [{ cur, prev }, trend] = await Promise.all([getMonthAndPrev(month), getTrend(month)]);
  const n = cur.news;
  const p = prev.news.hasData ? prev.news : null;
  const quota = contentQuota(cur, "news");
  const prevQuota = prev.news.hasData ? contentQuota(prev, "news") : null;
  const recs = generateRecommendations({ cur, prev }).filter((r) => r.channel === "news");
  const labels = trend.map((t) => ({ ...t, label: monthLabel(t.month, true) }));

  if (!n.hasData) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader title="News" month={month} months={months} />
        <EmptyState channel="News" month={month} source="News Content Logs" />
      </div>
    );
  }

  const publishedCount = n.articles.filter((a) => a.status === "publish").length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="News" description={`Artikel yang dipublish ${monthLabel(month)} · views selama ${monthLabel(month)}`} month={month} months={months} />

      {n.viewsSource === "report" && (
        <Notice>Views per artikel memakai angka dari report News (sheet Article Performance). Import GA4 Pages and screens (CSV) bulan ini untuk mencocokkan langsung dari GA4.</Notice>
      )}
      {n.viewsSource === null && <Notice tone="warn">Belum ada data views (GA4 Pages and screens) untuk {monthLabel(month)} — views artikel kosong.</Notice>}

      {/* 1. Kuota tercapai + produksi vs kuota */}
      <div className="grid gap-4 lg:grid-cols-3">
        <QuotaHero q={quota} prev={prevQuota} month={month} />
        <Section title="Delivered vs kuota" subtitle="Artikel per bulan · delivered = published + in review · 6 bulan terakhir" className="lg:col-span-2">
          <TrendChart
            data={labels}
            series={[
              { key: "newsPublished", name: "Published" },
              { key: "newsDelivered", name: "Delivered (+ review)" },
              { key: "newsQuota", name: "Kuota", reference: true },
            ]}
          />
        </Section>
      </div>

      {/* 2. KPI — definisi bersama dengan kartu KPI laporan Google Sheets (lib/reports/kpi.ts) */}
      <KpiGrid cols={4}>
        {NEWS_KPIS.map((k) => {
          const cur = k.get(n);
          const value = k.display?.(n) ?? (k.kind === "rate" ? fmtPct(cur) : k.kind === "duration" ? fmtDuration(cur) : k.kind === "decimal" ? fmtNum(cur, 1) : fmtNum(cur));
          const note =
            k.key === "published"
              ? `${fmtNum(n.activeDays)} hari aktif · jeda terpanjang ${fmtNum(n.emptyStreak.length)} hari`
              : k.key === "views"
                ? `${fmtNum(n.matchedCount)}/${fmtNum(publishedCount)} URL cocok dengan GA4${n.unmatched.length ? ` · ${n.unmatched.length} tidak cocok` : ""}`
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
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Views" subtitle="6 bulan terakhir">
          <TrendChart data={labels} series={[{ key: "newsViews", name: "Views" }]} />
        </Section>
        <Section title="Harian · artikel publish" subtitle={`${fmtNum(n.activeDays)} hari aktif · ${monthLabel(month)}`}>
          <TrendChart data={n.daily.map((d) => ({ label: fmtDate(d.date, false), count: d.count }))} series={[{ key: "count", name: "Artikel" }]} type="bar" />
        </Section>
      </div>

      {/* 4. Breakdown + top konten */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Per kategori" subtitle="Views per artikel">
          <BreakdownBars data={n.byCategory.map((c) => ({ label: c.label, value: c.perContent }))} name="Views/artikel" />
          <DataTable
            rows={n.byCategory}
            columns={[
              { header: "Kategori", cell: (r) => r.label },
              { header: "Artikel", align: "right", cell: (r) => fmtNum(r.count) },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
            ]}
          />
        </Section>
        <Section title="Top artikel" subtitle="Berdasarkan views" className="lg:col-span-2">
          <DataTable
            rows={n.topArticles}
            empty="Belum ada data views."
            columns={[
              { header: "#", cell: (_, i) => i + 1, className: "text-muted-foreground" },
              {
                header: "Judul",
                cell: (r) =>
                  r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                      {truncate(r.title, 70)}
                    </a>
                  ) : (
                    truncate(r.title, 70)
                  ),
              },
              { header: "Tanggal", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span> },
              { header: "Kategori", cell: (r) => r.category ?? "—" },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Avg eng.", align: "right", cell: (r) => fmtDuration(r.avgEngagementTime) },
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Per reporter" subtitle="Artikel dengan >1 reporter dihitung untuk tiap reporter">
          <DataTable
            rows={n.byReporter}
            columns={[
              { header: "Reporter", cell: (r) => r.label },
              { header: "Artikel", align: "right", cell: (r) => fmtNum(r.count) },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Views/art.", align: "right", cell: (r) => fmtNum(r.perContent) },
            ]}
          />
        </Section>
        <Section title="Per tipe" subtitle="Hard News / Features / Editorial">
          <BreakdownBars data={n.byType.map((c) => ({ label: c.label, value: c.perContent }))} name="Views/artikel" />
          <DataTable
            rows={n.byType}
            columns={[
              { header: "Tipe", cell: (r) => r.label },
              { header: "Artikel", align: "right", cell: (r) => fmtNum(r.count) },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
            ]}
          />
        </Section>
      </div>

      {/* 5. Bulan ini vs bulan lalu + rekomendasi */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CompareTable
          month={month}
          hasPrev={!!p}
          rows={[
            { label: "Published", cur: n.published, prev: p?.published, fmt: fmtNum },
            { label: "Kuota tercapai", cur: quota.rate, prev: prevQuota?.rate, fmt: (v) => fmtPct(v), kind: "rate" },
            { label: "Views", cur: n.totalViews, prev: p?.totalViews, fmt: fmtNum },
            { label: "Views / artikel", cur: n.viewsPerArticle, prev: p?.viewsPerArticle, fmt: fmtNum },
            { label: "Pembaca", cur: n.readers, prev: p?.readers, fmt: fmtNum },
            { label: "Avg engagement", cur: n.avgEngagementTime, prev: p?.avgEngagementTime, fmt: fmtDuration },
            { label: "In review", cur: n.inReview, prev: p?.inReview, fmt: fmtNum, neutral: true },
            { label: "Hari aktif publish", cur: n.activeDays, prev: p?.activeDays, fmt: fmtNum },
          ]}
        />
        <Recommendations items={recs} title="Rekomendasi news" showChannel={false} />
      </div>

      {(n.unmatched.length > 0 || n.zeroViews.length > 0) && (
        <Section title="Perlu dicek" subtitle="Artikel published yang tidak cocok dengan data views, atau 0 views">
          <DataTable
            rows={[...n.unmatched, ...n.zeroViews]}
            columns={[
              { header: "Judul", cell: (r) => truncate(r.title, 70) },
              { header: "URL", cell: (r) => <span className="break-all text-muted-foreground">{r.path ?? "(tanpa URL)"}</span> },
              { header: "Masalah", cell: (r) => <StatusBadge tone="warn">{r.matched ? "0 views" : "Tidak cocok"}</StatusBadge> },
            ]}
          />
        </Section>
      )}

      <Section title="Semua artikel" subtitle={`${n.articles.length} baris dari content log`}>
        <DataTable
          rows={n.articles}
          columns={[
            { header: "Tanggal", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span> },
            { header: "Judul", cell: (r) => truncate(r.title, 70) },
            { header: "Reporter", cell: (r) => r.reporter ?? "—" },
            { header: "Kategori", cell: (r) => r.category ?? "—" },
            { header: "Tipe", cell: (r) => r.type ?? "—" },
            { header: "Status", cell: (r) => <StatusBadge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? "neutral"}>{r.status}</StatusBadge> },
            { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
          ]}
        />
      </Section>
    </div>
  );
}
