import { PageHeader } from "@/components/PageHeader";
import { Section, CompareTable, DataTable, DeltaBadge, EmptyState, KpiCard, KpiGrid, Notice, QuotaHero } from "@/components/blocks";
import { BreakdownBars, TrendChart, type SeriesDef } from "@/components/charts";
import { Recommendations } from "@/components/Recommendations";
import { SocialRecon } from "@/components/SocialRecon";
import { contentQuota, getMonthAndPrev, getTrend, resolveMonth, socialKpiSources } from "@/lib/data/summary";
import { SOCIAL_KPIS } from "@/lib/reports/kpi";
import { generateRecommendations } from "@/lib/recommendations";
import { fmtDate, fmtNum, fmtPct, truncate } from "@/lib/format";
import { monthLabel, prevMonth } from "@/lib/month";
import { FORMAT_LABEL, PLATFORM_LABEL } from "@/lib/sources";
import { WIB, dateIn } from "@/lib/tz";

export const dynamic = "force-dynamic";

const fmtLabel = (platform: string, format: string) => `${PLATFORM_LABEL[platform] ?? platform} · ${FORMAT_LABEL[format] ?? format}`;
const perPost = (v: number | null | undefined, n: number | null | undefined) => (v == null || !n ? null : v / n);
/** Tanggal (WIB) dari timestamp sync — acuan metrik lifetime. */
const wibDate = (d: Date) => dateIn(d, WIB);
const POSTS_NOTE = "Jumlah metrik lifetime post yang dipublish bulan ini (export CSV lama).";

const FOLLOWS_HINT: Record<"manual" | "account" | "posts", string> = {
  account: "Follow baru ke akun Instagram selama bulan ini (insight akun via API). Catatan: berbeda dari export CSV lama yang hanya menjumlah follow per post.",
  posts: "Jumlah follow per post (export CSV Meta). Bulan yang disync lewat API memakai follow akun.",
  manual: "Diisi lewat input manual.",
};

export default async function SocialPage({ searchParams }: PageProps<"/social">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const [{ cur, prev }, trend] = await Promise.all([getMonthAndPrev(month), getTrend(month)]);
  const s = cur.social;
  const kpi = socialKpiSources(cur.social, prev.social.hasData ? prev.social : null);
  const cmp = kpi.cmp;
  const c = cmp?.cur;
  const p = cmp?.prev;
  const quota = contentQuota(cur, "social");
  const prevQuota = prev.social.hasData ? contentQuota(prev, "social") : null;
  const recs = generateRecommendations({ cur, prev }).filter((r) => r.channel === "social");
  const labels = trend.map((t) => ({ ...t, label: monthLabel(t.month, true) }));
  const asOf = s.postsAsOf ? ` per ${fmtDate(wibDate(s.postsAsOf))}` : "";
  const prevType = (type: string) => prev.social.byType?.rows.find((r) => r.type === type)?.views ?? null;

  // Satu garis "Views" jika hanya satu platform di rentang tren; per platform jika campur (supaya bulan IG vs FB tidak terbaca naik/turun)
  const mixed = trend.some((t) => t.viewsFacebook != null) && trend.some((t) => t.viewsInstagram != null);
  const viewSeries: SeriesDef[] = mixed
    ? [
        { key: "viewsInstagram", name: "Instagram" },
        { key: "viewsFacebook", name: "Facebook" },
      ]
    : [{ key: "socialViews", name: "Views" }];

  if (!s.hasData) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Social Media" month={month} months={months} />
        <EmptyState channel="Social Media" month={month} source="Meta Business Suite / publishing log" />
      </div>
    );
  }

  const platformNames = s.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(" + ") || "—";

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="Social Media" description={`Post yang dipublish ${monthLabel(month)} · ${platformNames}`} month={month} months={months} />

      {prev.social.hasData && !cmp && (
        <Notice tone="warn">
          Data {monthLabel(prevMonth(month))} berasal dari platform berbeda ({prev.social.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(", ")}), jadi MoM tidak dihitung.
        </Notice>
      )}
      {cmp?.partial && <Notice>MoM hanya membandingkan platform yang ada di kedua bulan: {cmp.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(", ")}.</Notice>}
      {s.metricsSource === "account" && (
        <Notice>
          Views, reach, interactions, engagement rate & follows = <b>selama {monthLabel(month)}</b> dari insight akun Instagram (termasuk Stories & post lama). Tabel per post, per
          format & per kategori = metrik lifetime post yang dipublish bulan ini (sejak publish).
          {prev.social.hasData && prev.social.metricsSource !== s.metricsSource && ` ${monthLabel(prevMonth(month))} masih dari export CSV (definisi lama), jadi MoM metrik ini tidak dihitung.`}
        </Notice>
      )}
      {!s.hasLog && <Notice>Publishing log belum di-import — jumlah post dihitung dari export Meta dan breakdown kategori belum tersedia.</Notice>}

      {/* 1. Kuota tercapai + produksi vs kuota */}
      <div className="grid gap-4 lg:grid-cols-3">
        <QuotaHero q={quota} prev={prevQuota} month={month} />
        <Section title="Delivered vs kuota" subtitle="Post per bulan (semua format) · delivered = published + in review · 6 bulan terakhir" className="lg:col-span-2">
          <TrendChart
            data={labels}
            series={[
              { key: "socialQuotaCount", name: "Published" },
              { key: "socialDelivered", name: "Delivered (+ review)" },
              { key: "socialQuota", name: "Kuota", reference: true },
            ]}
          />
        </Section>
      </div>

      {/* 2. KPI — definisi bersama dengan kartu KPI laporan Google Sheets (lib/reports/kpi.ts) */}
      <KpiGrid cols={4}>
        {SOCIAL_KPIS.map((k) => {
          const cur = k.get(kpi.cur);
          const value =
            k.key === "delivered"
              ? quota.available
                ? `${fmtNum(quota.achieved)}/${fmtNum(quota.target)}`
                : fmtNum(s.postsPublished)
              : k.key === "active_days"
                ? `${fmtNum(cur)} hari`
                : k.kind === "rate"
                  ? fmtPct(cur, 2)
                  : fmtNum(cur);
          const note =
            k.key === "delivered"
              ? `${fmtNum(s.postsPublished)} published + ${fmtNum(s.inReview)} in review · ${s.countSource === "log" ? "dari publishing log" : "dari export Meta"}`
              : k.key === "follows" && prev.social.hasData && prev.social.followsSource !== s.followsSource && s.follows != null
                ? "Definisi beda dari bulan lalu — tidak dibandingkan"
                : k.key === "active_days"
                  ? `Jeda terpanjang ${fmtNum(s.emptyStreak.length)} hari`
                  : undefined;
          const hint =
            k.key === "views" && s.metricsSource !== "account"
              ? POSTS_NOTE
              : k.key === "follows"
                ? FOLLOWS_HINT[s.followsSource ?? "posts"]
                : k.key === "views_per_post"
                  ? `Rata-rata views lifetime per post yang dipublish bulan ini (sejak publish${asOf}).`
                  : k.hint;
          return (
            <KpiCard
              key={k.key}
              label={k.label}
              value={value}
              cur={k.key === "delivered" ? (quota.available ? quota.achieved : null) : cur}
              prev={kpi.prev ? k.get(kpi.prev) : null}
              kind={k.kind === "rate" ? "rate" : undefined}
              goodWhenUp={k.goodWhenUp}
              hint={hint}
              note={note}
            />
          );
        })}
      </KpiGrid>

      {s.byType && (
        <Section
          title="Per jenis konten · selama bulan ini"
          subtitle={`Insight akun Instagram ${monthLabel(month)} (per periode — tidak berubah saat sync ulang) · termasuk post lama yang masih ditonton bulan ini`}
        >
          <DataTable
            rows={s.byType.rows}
            columns={[
              { header: "Jenis", cell: (r) => r.label },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Porsi views", align: "right", cell: (r) => fmtPct(r.share) },
              { header: "Reach", align: "right", cell: (r) => fmtNum(r.reach) },
              {
                header: "Views MoM",
                align: "right",
                cell: (r) => {
                  // basis bulan lalu terlalu kecil → persen tidak bermakna (mis. 30 → 20.135 views)
                  const p = prevType(r.type);
                  const tiny = p != null && p < 1000;
                  return <DeltaBadge cur={r.views} prev={tiny ? null : p} emptyText={tiny ? `Bulan lalu ${fmtNum(p)} views` : undefined} />;
                },
              },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Interactions: Reels {fmtNum(s.byType.interactions.reels)} · Feeds (carousel + foto) {fmtNum(s.byType.interactions.feeds)} · Story {fmtNum(s.byType.interactions.story)} — Meta
            menggabungkan carousel & foto untuk interactions. Reach per jenis = akun unik per jenis (tidak bisa dijumlah); bulan 31 hari hanya 30 hari pertama.
            &ldquo;Foto / lainnya&rdquo; = jenis POST dari Meta.
          </p>
        </Section>
      )}

      {/* 3. Performa & aktivitas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Views" subtitle={`6 bulan terakhir${mixed ? " · per platform" : ""}`}>
          <TrendChart data={labels} series={viewSeries} />
        </Section>
        <Section title="Harian · post publish" subtitle={`${fmtNum(s.activeDays)} hari aktif · ${monthLabel(month)}`}>
          <TrendChart data={s.daily.map((d) => ({ label: fmtDate(d.date, false), posts: d.posts }))} series={[{ key: "posts", name: "Post" }]} type="bar" />
        </Section>
      </div>

      {/* 4. Breakdown + top konten */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Per format" subtitle={`Post dari Meta API (tanpa Stories) · format dari ${s.hasLog ? "Publishing Log" : "Meta"} · views lifetime per post${asOf}`}>
          <BreakdownBars data={s.byFormat.map((f) => ({ label: fmtLabel(f.platform, f.format), value: f.avgViews }))} name="Views/post" />
          <DataTable
            rows={s.byFormat}
            columns={[
              { header: "Format", cell: (r) => fmtLabel(r.platform, r.format) },
              { header: "Post", align: "right", cell: (r) => fmtNum(r.posts) },
              { header: "Reach", align: "right", cell: (r) => fmtNum(r.reach) },
              { header: "ER", align: "right", cell: (r) => fmtPct(r.er, 2) },
            ]}
          />
        </Section>
        <Section
          title="Top post"
          subtitle={`Berdasarkan views lifetime (sejak publish${asOf})${s.monthViewsAsOf ? ` · "Views bulan ini" = s/d snapshot ${fmtDate(s.monthViewsAsOf)}` : " · views bulan ini tersedia setelah snapshot awal bulan depan"}`}
          className="lg:col-span-2"
        >
          <DataTable
            rows={[...s.posts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 10)}
            columns={[
              { header: "#", cell: (_, i) => i + 1, className: "text-muted-foreground" },
              {
                header: "Post",
                cell: (r) =>
                  r.permalink ? (
                    <a href={r.permalink} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                      {truncate(r.caption, 60) || "(tanpa caption)"}
                    </a>
                  ) : (
                    truncate(r.caption, 60)
                  ),
              },
              { header: "Tanggal", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span> },
              { header: "Format", cell: (r) => <span className="whitespace-nowrap">{fmtLabel(r.platform, r.format)}</span> },
              ...(s.monthViewsAsOf ? [{ header: "Views bulan ini", align: "right" as const, cell: (r: (typeof s.posts)[number]) => fmtNum(r.monthViews) }] : []),
              { header: s.monthViewsAsOf ? "Views lifetime" : "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Reach", align: "right", cell: (r) => fmtNum(r.reach) },
              { header: "Interaksi", align: "right", cell: (r) => fmtNum(r.interactions) },
              { header: "ER", align: "right", cell: (r) => fmtPct(r.er, 2) },
            ]}
          />
        </Section>
      </div>

      {s.byCategory.length > 0 && (
        <Section title="Per kategori" subtitle="Kategori dari publishing log">
          <DataTable
            rows={s.byCategory}
            columns={[
              { header: "Kategori", cell: (r) => r.label },
              { header: "Post", align: "right", cell: (r) => fmtNum(r.posts) },
              { header: "Views/post", align: "right", cell: (r) => fmtNum(r.avgViews) },
              { header: "Reach/post", align: "right", cell: (r) => fmtNum(r.avgReach) },
              { header: "ER", align: "right", cell: (r) => fmtPct(r.er, 2) },
            ]}
          />
        </Section>
      )}

      {s.recon && <SocialRecon r={s.recon} stories={s.stories} />}

      {s.collabPosts.length > 0 && (
        <Section
          title="Repost / kolaborasi dari akun lain"
          subtitle={`${fmtNum(s.collabPosts.length)} post di export Meta milik akun lain (kolaborasi) — tidak dihitung ke performa maupun kuota MKK.`}
        >
          <DataTable
            rows={[...s.collabPosts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))}
            columns={[
              { header: "Tanggal (WIB)", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span> },
              { header: "Akun", cell: (r) => <span className="whitespace-nowrap">@{r.account}</span> },
              { header: "Format", cell: (r) => <span className="whitespace-nowrap">{fmtLabel(r.platform, r.format)}</span> },
              {
                header: "Post",
                cell: (r) =>
                  r.permalink ? (
                    <a href={r.permalink} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                      {truncate(r.caption, 60) || "(tanpa caption)"}
                    </a>
                  ) : (
                    truncate(r.caption, 60)
                  ),
              },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Reach", align: "right", cell: (r) => fmtNum(r.reach) },
            ]}
          />
        </Section>
      )}

      {/* 5. Bulan ini vs bulan lalu + rekomendasi */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CompareTable
          month={month}
          hasPrev={!!cmp}
          footnote={cmp ? `Dibandingkan untuk platform: ${cmp.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(", ")}.` : undefined}
          rows={[
            { label: "Published (kuota)", cur: quota.available ? quota.published : null, prev: prevQuota?.available ? prevQuota.published : null, fmt: fmtNum },
            { label: "Kuota tercapai", cur: quota.rate, prev: prevQuota?.rate, fmt: (v) => fmtPct(v), kind: "rate" },
            { label: "Views", cur: c?.views ?? s.views, prev: p?.views, fmt: fmtNum },
            { label: "Views / post", cur: perPost(c?.postViews ?? s.postViews, c?.posts ?? s.posts.length), prev: perPost(p?.postViews, p?.posts), fmt: fmtNum },
            { label: "Reach", cur: c?.reach ?? s.reach, prev: p?.reach, fmt: fmtNum },
            { label: "Engagement rate", cur: c?.engagementRate ?? s.engagementRate, prev: p?.engagementRate, fmt: (v) => fmtPct(v, 2), kind: "rate" },
            { label: "Interactions", cur: c?.interactions ?? s.interactions, prev: p?.interactions, fmt: fmtNum },
            { label: "Follows", cur: c?.follows ?? s.follows, prev: p?.follows, fmt: fmtNum },
            { label: "Hari aktif publish", cur: s.activeDays, prev: prev.social.hasData ? prev.social.activeDays : null, fmt: fmtNum },
          ]}
        />
        <Recommendations items={recs} title="Rekomendasi social media" showChannel={false} />
      </div>
    </div>
  );
}
