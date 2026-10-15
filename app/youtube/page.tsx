import { PageHeader } from "@/components/PageHeader";
import { Section, CompareTable, DataTable, EmptyState, KpiCard, KpiGrid, Notice, QuotaHero } from "@/components/blocks";
import { BreakdownBars, TrendChart } from "@/components/charts";
import { Recommendations } from "@/components/Recommendations";
import { contentQuota, getMonthAndPrev, getTrend, resolveMonth } from "@/lib/data/summary";
import { generateRecommendations } from "@/lib/recommendations";
import { fmtDate, fmtDuration, fmtNum, fmtPct, truncate } from "@/lib/format";
import { monthLabel } from "@/lib/month";

export const dynamic = "force-dynamic";

const perVideo = (views: number | null, count: number) => (views == null || !count ? null : views / count);

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
      <div className="mx-auto max-w-7xl">
        <PageHeader title="YouTube" month={month} months={months} />
        <EmptyState channel="YouTube" month={month} source="YouTube Studio" />
      </div>
    );
  }

  const vpv = perVideo(y.views, y.videos.length);
  const prevVpv = p ? perVideo(p.views, p.videos.length) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="YouTube" description={`Video yang dipublish ${monthLabel(month)} · performa selama ${monthLabel(month)}`} month={month} months={months} />
      <Notice>
        Definisi laporan: semua angka di halaman ini hanya dari video yang <b>dipublish di {monthLabel(month)}</b>, dengan views/watch time yang terjadi selama {monthLabel(month)} (sama seperti report News).
      </Notice>

      {/* 1. Kuota tercapai + produksi vs kuota */}
      <div className="grid gap-4 lg:grid-cols-3">
        <QuotaHero q={quota} prev={prevQuota} month={month} />
        <Section title="Published vs kuota" subtitle="Video per bulan · 6 bulan terakhir" className="lg:col-span-2">
          <TrendChart data={labels} series={[{ key: "ytPublished", name: "Published" }, { key: "ytQuota", name: "Kuota", reference: true }]} />
        </Section>
      </div>

      {/* 2. KPI — urutan sama di semua channel */}
      <KpiGrid cols={4}>
        <KpiCard label="Published" value={`${fmtNum(y.published)}/${fmtNum(y.quota.value)}`} cur={y.published} prev={p?.published} />
        <KpiCard label="Views" value={fmtNum(y.views)} cur={y.views} prev={p?.views} />
        <KpiCard label="Views / video" value={fmtNum(vpv)} cur={vpv} prev={prevVpv} />
        <KpiCard label="Impressions" value={fmtNum(y.impressions)} cur={y.impressions} prev={p?.impressions} hint="Berapa kali thumbnail ditampilkan di YouTube." />
        <KpiCard label="Impressions CTR" value={fmtPct(y.ctr, 2)} cur={y.ctr} prev={p?.ctr} kind="rate" hint="Rasio klik thumbnail. Di bawah 4% = perlu perbaikan thumbnail/judul." />
        <KpiCard label="Watch time" value={`${fmtNum(y.watchHours, 1)} jam`} cur={y.watchHours} prev={p?.watchHours} />
        <KpiCard label="Avg view duration" value={fmtDuration(y.avgViewDurationSec)} cur={y.avgViewDurationSec} prev={p?.avgViewDurationSec} />
        <KpiCard
          label="Subscribers (net)"
          value={y.subsNet == null ? "—" : `${y.subsNet > 0 ? "+" : ""}${fmtNum(y.subsNet)}`}
          cur={y.subsNet}
          prev={p?.subsNet}
          note={y.hasSubsLost ? `+${fmtNum(y.subsGained)} / −${fmtNum(y.subsLost)}` : "Data subscribers lost tidak ada"}
        />
      </KpiGrid>

      {/* 3. Performa & aktivitas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Views" subtitle="6 bulan terakhir">
          <TrendChart data={labels} series={[{ key: "ytViews", name: "Views" }]} />
        </Section>
        <Section title="Harian · watch time (jam)" subtitle={monthLabel(month)}>
          {y.daily.length ? (
            <TrendChart data={y.daily.map((d) => ({ label: fmtDate(d.date, false), wh: d.watchHours }))} series={[{ key: "wh", name: "Watch time" }]} type="bar" format="hours" />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada data harian. Export YouTube Studio dengan metrik grafik <b>Watch time (hours)</b>, lalu upload Totals.csv.
            </p>
          )}
        </Section>
      </div>

      {/* 4. Breakdown + top konten */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Per kategori" subtitle="Views per video · kategori dari publishing log">
          {y.byCategory.length > 0 && <BreakdownBars data={y.byCategory.map((c) => ({ label: c.label, value: c.perContent }))} name="Views/video" />}
          <DataTable
            rows={y.byCategory}
            empty="Import publishing log YouTube untuk melihat kategori."
            columns={[
              { header: "Kategori", cell: (r) => r.label },
              { header: "Video", align: "right", cell: (r) => fmtNum(r.count) },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
            ]}
          />
        </Section>
        <Section title="Top video" subtitle="Berdasarkan views" className="lg:col-span-2">
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
              { header: "Watch (jam)", align: "right", cell: (r) => fmtNum(r.watchHours, 1) },
              { header: "AVD", align: "right", cell: (r) => fmtDuration(r.avgViewDurationSec) },
              { header: "Impr.", align: "right", cell: (r) => fmtNum(r.impressions) },
              { header: "CTR", align: "right", cell: (r) => <span className={r.ctr != null && r.ctr < 0.04 ? "font-medium text-danger" : ""}>{fmtPct(r.ctr, 2)}</span> },
              { header: "Subs", align: "right", cell: (r) => fmtNum(r.subsGained) },
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
            { label: "Published", cur: y.published, prev: p?.published, fmt: fmtNum },
            { label: "Kuota tercapai", cur: quota.rate, prev: prevQuota?.rate, fmt: (v) => fmtPct(v), kind: "rate" },
            { label: "Views", cur: y.views, prev: p?.views, fmt: fmtNum },
            { label: "Views / video", cur: vpv, prev: prevVpv, fmt: fmtNum },
            { label: "Impressions", cur: y.impressions, prev: p?.impressions, fmt: fmtNum },
            { label: "Impressions CTR", cur: y.ctr, prev: p?.ctr, fmt: (v) => fmtPct(v, 2), kind: "rate" },
            { label: "Watch time (jam)", cur: y.watchHours, prev: p?.watchHours, fmt: (v) => fmtNum(v, 1) },
            { label: "Avg view duration", cur: y.avgViewDurationSec, prev: p?.avgViewDurationSec, fmt: fmtDuration },
            { label: "Subscribers net", cur: y.subsNet, prev: p?.subsNet, fmt: fmtNum },
          ]}
        />
        <Recommendations items={recs} title="Rekomendasi YouTube" showChannel={false} />
      </div>
    </div>
  );
}
