import { PageHeader } from "@/components/PageHeader";
import { ChartCard } from "@/components/ChartCard";
import { Section, CompareTable, DataTable, DeltaBadge, EmptyState, KpiCard, KpiGrid, Notice, QuotaHero } from "@/components/blocks";
import { BreakdownBars, type SeriesDef } from "@/components/charts";
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
const POSTS_NOTE = "Sum of lifetime metrics for posts published this month (legacy CSV export).";

const FOLLOWS_HINT: Record<"manual" | "account" | "posts", string> = {
  account: "New follows to the Instagram account during this month (account insights via API). Note: differs from the legacy CSV export, which only summed follows per post.",
  posts: "Sum of follows per post (Meta CSV export). Months synced via the API use account follows.",
  manual: "Entered manually.",
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
  const asOf = s.postsAsOf ? ` as of ${fmtDate(wibDate(s.postsAsOf))}` : "";
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
      <div className="flex flex-col gap-6">
        <PageHeader title="Social Media" month={month} months={months} />
        <EmptyState channel="Social Media" month={month} source="Meta Business Suite / publishing log" />
      </div>
    );
  }

  const platformNames = s.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(" + ") || "—";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Social Media" description={`Posts published in ${monthLabel(month)} · ${platformNames}`} month={month} months={months} />

      {prev.social.hasData && !cmp && (
        <Notice tone="warn">
          {monthLabel(prevMonth(month))} data comes from a different platform ({prev.social.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(", ")}), so MoM isn&apos;t calculated.
        </Notice>
      )}
      {cmp?.partial && <Notice>MoM only compares platforms present in both months: {cmp.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(", ")}.</Notice>}
      {s.metricsSource === "account" && (
        <Notice>
          Views, reach, interactions, engagement rate & follows = <b>during {monthLabel(month)}</b> from Instagram account insights (including Stories & older posts). The per-post,
          per-format & per-category tables = lifetime metrics of posts published this month (since publishing).
          {prev.social.hasData && prev.social.metricsSource !== s.metricsSource && ` ${monthLabel(prevMonth(month))} still comes from the CSV export (old definition), so MoM isn't calculated for these metrics.`}
        </Notice>
      )}
      {!s.hasLog && <Notice>The publishing log hasn&apos;t been imported — post counts come from the Meta export and the category breakdown isn&apos;t available yet.</Notice>}

      {/* 1. Kuota tercapai + produksi vs kuota */}
      <div className="grid gap-6 lg:grid-cols-3">
        <QuotaHero q={quota} prev={prevQuota} month={month} />
        <ChartCard title="Delivered vs quota" description="Posts per month (all formats) · delivered = published + in review" className="lg:col-span-2"
            data={labels}
            series={[
              { key: "socialQuotaCount", name: "Published" },
              { key: "socialDelivered", name: "Delivered (+ review)" },
              { key: "socialQuota", name: "Quota", reference: true },
            ]} />
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
                ? `${fmtNum(cur)} days`
                : k.kind === "rate"
                  ? fmtPct(cur, 2)
                  : fmtNum(cur);
          const note =
            k.key === "delivered"
              ? `${fmtNum(s.postsPublished)} published + ${fmtNum(s.inReview)} in review · ${s.countSource === "log" ? "from the publishing log" : "from the Meta export"}`
              : k.key === "follows" && prev.social.hasData && prev.social.followsSource !== s.followsSource && s.follows != null
                ? "Definition differs from last month — not compared"
                : k.key === "active_days"
                  ? `Longest gap ${fmtNum(s.emptyStreak.length)} days`
                  : undefined;
          const hint =
            k.key === "views" && s.metricsSource !== "account"
              ? POSTS_NOTE
              : k.key === "follows"
                ? FOLLOWS_HINT[s.followsSource ?? "posts"]
                : k.key === "views_per_post"
                  ? `Average lifetime views per post published this month (since publishing${asOf}).`
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
          title="By content type · during this month"
          subtitle={`Instagram account insights for ${monthLabel(month)} (per period — doesn't change on re-sync) · includes older posts still watched this month`}
        >
          <DataTable
            rows={s.byType.rows}
            columns={[
              { header: "Type", cell: (r) => r.label },
              { header: "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Views share", align: "right", cell: (r) => fmtPct(r.share) },
              { header: "Reach", align: "right", cell: (r) => fmtNum(r.reach) },
              {
                header: "Views MoM",
                align: "right",
                cell: (r) => {
                  // basis bulan lalu terlalu kecil → persen tidak bermakna (mis. 30 → 20.135 views)
                  const p = prevType(r.type);
                  const tiny = p != null && p < 1000;
                  return <DeltaBadge cur={r.views} prev={tiny ? null : p} emptyText={tiny ? `Last month ${fmtNum(p)} views` : undefined} />;
                },
              },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Interactions: Reels {fmtNum(s.byType.interactions.reels)} · Feeds (carousel + photo) {fmtNum(s.byType.interactions.feeds)} · Story {fmtNum(s.byType.interactions.story)} — Meta
            combines carousels & photos for interactions. Reach per type = unique accounts per type (can&apos;t be summed); 31-day months only cover the first 30 days.
            &ldquo;Photo / other&rdquo; = Meta&apos;s POST type.
          </p>
        </Section>
      )}

      {/* 3. Performa & aktivitas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Views" description={mixed ? "Per platform" : undefined} data={labels} series={viewSeries} />
        <ChartCard title="Daily · posts published" description={`${fmtNum(s.activeDays)} active days · ${monthLabel(month)}`} data={s.daily.map((d) => ({ label: fmtDate(d.date, false), posts: d.posts }))} series={[{ key: "posts", name: "Posts" }]} granularity="day" />
      </div>

      {/* 4. Breakdown + top konten */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="By format" subtitle={`Posts from the Meta API (excluding Stories) · format from ${s.hasLog ? "Publishing Log" : "Meta"} · lifetime views per post${asOf}`}>
          <BreakdownBars data={s.byFormat.map((f) => ({ label: fmtLabel(f.platform, f.format), value: f.avgViews }))} name="Views/post" />
          <DataTable
            rows={s.byFormat}
            columns={[
              { header: "Format", cell: (r) => fmtLabel(r.platform, r.format) },
              { header: "Posts", align: "right", cell: (r) => fmtNum(r.posts) },
              { header: "Reach", align: "right", cell: (r) => fmtNum(r.reach) },
              { header: "ER", align: "right", cell: (r) => fmtPct(r.er, 2) },
            ]}
          />
        </Section>
        <Section
          title="Top posts"
          subtitle={`By lifetime views (since publishing${asOf})${s.monthViewsAsOf ? ` · "Views this month" = up to the ${fmtDate(s.monthViewsAsOf)} snapshot` : " · this month's views are available after next month's opening snapshot"}`}
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
                      {truncate(r.caption, 60) || "(no caption)"}
                    </a>
                  ) : (
                    truncate(r.caption, 60)
                  ),
              },
              { header: "Date", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span> },
              { header: "Format", cell: (r) => <span className="whitespace-nowrap">{fmtLabel(r.platform, r.format)}</span> },
              ...(s.monthViewsAsOf ? [{ header: "Views this month", align: "right" as const, cell: (r: (typeof s.posts)[number]) => fmtNum(r.monthViews) }] : []),
              { header: s.monthViewsAsOf ? "Views lifetime" : "Views", align: "right", cell: (r) => fmtNum(r.views) },
              { header: "Reach", align: "right", cell: (r) => fmtNum(r.reach) },
              { header: "Interaksi", align: "right", cell: (r) => fmtNum(r.interactions) },
              { header: "ER", align: "right", cell: (r) => fmtPct(r.er, 2) },
            ]}
          />
        </Section>
      </div>

      {s.byCategory.length > 0 && (
        <Section title="By category" subtitle="Category from the publishing log">
          <DataTable
            rows={s.byCategory}
            columns={[
              { header: "Category", cell: (r) => r.label },
              { header: "Posts", align: "right", cell: (r) => fmtNum(r.posts) },
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
          title="Reposts / collaborations from other accounts"
          subtitle={`${fmtNum(s.collabPosts.length)} posts in the Meta export belong to other accounts (collaborations) — not counted toward MKK performance or quota.`}
        >
          <DataTable
            rows={[...s.collabPosts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))}
            columns={[
              { header: "Date (WIB)", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span> },
              { header: "Account", cell: (r) => <span className="whitespace-nowrap">@{r.account}</span> },
              { header: "Format", cell: (r) => <span className="whitespace-nowrap">{fmtLabel(r.platform, r.format)}</span> },
              {
                header: "Post",
                cell: (r) =>
                  r.permalink ? (
                    <a href={r.permalink} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                      {truncate(r.caption, 60) || "(no caption)"}
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
      <div className="grid gap-6 lg:grid-cols-2">
        <CompareTable
          month={month}
          hasPrev={!!cmp}
          footnote={cmp ? `Compared for platforms: ${cmp.platforms.map((x) => PLATFORM_LABEL[x] ?? x).join(", ")}.` : undefined}
          rows={[
            { label: "Published (quota)", cur: quota.available ? quota.published : null, prev: prevQuota?.available ? prevQuota.published : null, fmt: fmtNum },
            { label: "Quota achieved", cur: quota.rate, prev: prevQuota?.rate, fmt: (v) => fmtPct(v), kind: "rate" },
            { label: "Views", cur: c?.views ?? s.views, prev: p?.views, fmt: fmtNum },
            { label: "Views / post", cur: perPost(c?.postViews ?? s.postViews, c?.posts ?? s.posts.length), prev: perPost(p?.postViews, p?.posts), fmt: fmtNum },
            { label: "Reach", cur: c?.reach ?? s.reach, prev: p?.reach, fmt: fmtNum },
            { label: "Engagement rate", cur: c?.engagementRate ?? s.engagementRate, prev: p?.engagementRate, fmt: (v) => fmtPct(v, 2), kind: "rate" },
            { label: "Interactions", cur: c?.interactions ?? s.interactions, prev: p?.interactions, fmt: fmtNum },
            { label: "Follows", cur: c?.follows ?? s.follows, prev: p?.follows, fmt: fmtNum },
            { label: "Active publishing days", cur: s.activeDays, prev: prev.social.hasData ? prev.social.activeDays : null, fmt: fmtNum },
          ]}
        />
        <Recommendations items={recs} title="Social media recommendations" showChannel={false} />
      </div>
    </div>
  );
}
