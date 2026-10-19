import { PageHeader } from "@/components/PageHeader";
import { Section, CompareTable, DataTable, EmptyState, KpiCard, KpiGrid, Notice, QuotaHero } from "@/components/blocks";
import { BreakdownBars, TrendChart, type SeriesDef } from "@/components/charts";
import { Recommendations } from "@/components/Recommendations";
import { SocialRecon } from "@/components/SocialRecon";
import { contentQuota, getMonthAndPrev, getTrend, resolveMonth, socialComparable } from "@/lib/data/summary";
import { generateRecommendations } from "@/lib/recommendations";
import { fmtDate, fmtNum, fmtPct, truncate } from "@/lib/format";
import { monthLabel, prevMonth } from "@/lib/month";
import { FORMAT_LABEL, PLATFORM_LABEL } from "@/lib/sources";

export const dynamic = "force-dynamic";

const fmtLabel = (platform: string, format: string) => `${PLATFORM_LABEL[platform] ?? platform} · ${FORMAT_LABEL[format] ?? format}`;
const perPost = (v: number | null | undefined, n: number | null | undefined) => (v == null || !n ? null : v / n);
const ACCOUNT_NOTE = "Insight akun Instagram selama bulan ini (API) — termasuk Stories & post lama, bukan hanya post yang dipublish bulan ini.";
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
  const cmp = socialComparable(cur.social, prev.social);
  const c = cmp?.cur;
  const p = cmp?.prev;
  const quota = contentQuota(cur, "social");
  const prevQuota = prev.social.hasData ? contentQuota(prev, "social") : null;
  const recs = generateRecommendations({ cur, prev }).filter((r) => r.channel === "social");
  const labels = trend.map((t) => ({ ...t, label: monthLabel(t.month, true) }));

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
        <Section title="Published vs kuota" subtitle="Post per bulan (semua format, dari Publishing Log) · 6 bulan terakhir" className="lg:col-span-2">
          <TrendChart data={labels} series={[{ key: "socialQuotaCount", name: "Published" }, { key: "socialQuota", name: "Kuota", reference: true }]} />
        </Section>
      </div>

      {/* 2. KPI — urutan sama di semua channel */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Published"
          value={quota.available ? `${fmtNum(quota.published)}/${fmtNum(quota.target)}` : fmtNum(s.postsPublished)}
          cur={quota.available ? quota.published : null}
          prev={prevQuota?.available ? prevQuota.published : null}
          note={`Total ${fmtNum(s.postsPublished)} post · ${s.countSource === "log" ? "dari publishing log" : "dari export Meta"}`}
        />
        <KpiCard label="Views" value={fmtNum(s.views)} cur={c?.views ?? null} prev={p?.views ?? null} hint={s.metricsSource === "account" ? ACCOUNT_NOTE : POSTS_NOTE} />
        <KpiCard
          label="Views / post"
          value={fmtNum(perPost(s.postViews, s.posts.length))}
          cur={perPost(c?.postViews, c?.posts)}
          prev={perPost(p?.postViews, p?.posts)}
          hint="Rata-rata views lifetime per post yang dipublish bulan ini (sejak publish)."
        />
        <KpiCard
          label="Reach"
          value={fmtNum(s.reach)}
          cur={c?.reach ?? null}
          prev={p?.reach ?? null}
          hint={
            s.metricsSource === "account"
              ? "Akun unik yang melihat konten selama bulan ini (insight akun). Untuk bulan 31 hari Meta hanya memberi 30 hari pertama."
              : "Jumlah reach per post (bukan reach unik akun)."
          }
        />
        <KpiCard
          label="Engagement rate"
          value={fmtPct(s.engagementRate, 2)}
          cur={c?.engagementRate ?? null}
          prev={p?.engagementRate ?? null}
          kind="rate"
          hint={s.metricsSource === "account" ? "Interactions ÷ reach akun selama bulan ini. Catatan: lebih tinggi dari ER per post karena pembaginya akun unik." : "Interactions ÷ reach."}
        />
        <KpiCard
          label="Interactions"
          value={fmtNum(s.interactions)}
          cur={c?.interactions ?? null}
          prev={p?.interactions ?? null}
          hint={s.metricsSource === "account" ? "Total interaksi (likes, comments, shares, saves, replies) di semua konten selama bulan ini — insight akun." : "IG: likes + comments + shares + saves. FB: reactions, comments & shares."}
        />
        <KpiCard
          label="Follows"
          value={fmtNum(s.follows)}
          cur={c?.follows ?? null}
          prev={p?.follows ?? null}
          hint={FOLLOWS_HINT[s.followsSource ?? "posts"]}
          note={prev.social.hasData && prev.social.followsSource !== s.followsSource && s.follows != null ? "Definisi beda dari bulan lalu — tidak dibandingkan" : undefined}
        />
        <KpiCard label="Hari aktif publish" value={`${fmtNum(s.activeDays)} hari`} cur={s.activeDays} prev={prev.social.hasData ? prev.social.activeDays : null} note={`Jeda terpanjang ${fmtNum(s.emptyStreak.length)} hari`} />
      </KpiGrid>

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
        <Section title="Per format" subtitle={`Post dari Meta API (tanpa Stories) · format dari ${s.hasLog ? "Publishing Log" : "Meta"} · views lifetime per post`}>
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
        <Section title="Top post" subtitle="Berdasarkan views lifetime (sejak publish)" className="lg:col-span-2">
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
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
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
