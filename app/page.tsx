import Link from "next/link";
import { CircleCheck, CircleDashed, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Section, KpiCard, KpiGrid, Notice, QuotaMini } from "@/components/blocks";
import { TrendChart } from "@/components/charts";
import { Recommendations } from "@/components/Recommendations";
import { contentQuota, getMonthAndPrev, getTrend, overviewComparison, overviewKpis, resolveMonth, socialComparable } from "@/lib/data/summary";
import { generateRecommendations } from "@/lib/recommendations";
import { fmtNum } from "@/lib/format";
import { monthLabel, prevMonth } from "@/lib/month";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const [{ cur, prev }, trend] = await Promise.all([getMonthAndPrev(month), getTrend(month)]);
  const kpi = overviewKpis(cur);
  const cmp = overviewComparison(cur, prev);
  const recs = generateRecommendations({ cur, prev });
  const labels = trend.map((t) => ({ ...t, label: monthLabel(t.month, true) }));

  const channels = [
    { key: "website", label: "Website", has: cur.website.hasData, href: "/website" },
    { key: "news", label: "News", has: cur.news.hasData, href: "/news" },
    { key: "youtube", label: "YouTube", has: cur.youtube.hasData, href: "/youtube" },
    { key: "social", label: "Social Media", has: cur.social.hasData, href: "/social" },
  ];
  const anyPartial = cmp.totalReach?.partial || cmp.totalEngagement?.partial;
  const soc = socialComparable(cur.social, prev.social);
  const socialMixed = trend.some((t) => t.viewsFacebook != null) && trend.some((t) => t.viewsInstagram != null);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Overview"
        month={month}
        months={months}
        actions={
          <Button asChild>
            <Link href={`/report?m=${month}`}>
              <FileDown /> Export PDF
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {channels.map((c) => (
          <Badge key={c.key} asChild variant="outline" className={c.has ? "" : "border-dashed text-muted-foreground"}>
            <Link href={c.has ? `${c.href}?m=${month}` : `/import?m=${month}`}>
              {c.has ? <CircleCheck className="text-success" /> : <CircleDashed />}
              {c.label}: {c.has ? "ada data" : "belum di-import"}
            </Link>
          </Badge>
        ))}
      </div>

      <KpiGrid>
        <KpiCard
          label="Total reach / impressions"
          value={fmtNum(kpi.totalReach)}
          cur={cmp.totalReach?.cur ?? null}
          prev={cmp.totalReach?.prev ?? null}
          partial={cmp.totalReach?.partial}
          hint="Impressions Google Search + impressions thumbnail YouTube + reach post sosmed (jumlah reach per post)."
        />
        <KpiCard
          label="Total engagement"
          value={fmtNum(kpi.totalEngagement)}
          cur={cmp.totalEngagement?.cur ?? null}
          prev={cmp.totalEngagement?.prev ?? null}
          partial={cmp.totalEngagement?.partial}
          hint="Interaksi sosmed (likes/reaksi + komentar + share + save) + engaged sessions website."
        />
        <KpiCard label="Website users" value={fmtNum(kpi.websiteUsers)} cur={cmp.websiteUsers?.[0] ?? null} prev={cmp.websiteUsers?.[1] ?? null} note={cur.website.usersEstimated ? "Estimasi (jumlah per kota)" : undefined} />
        <KpiCard label="News views" hint="Views artikel yang dipublish bulan ini, selama bulan ini." value={fmtNum(cur.news.totalViews)} cur={cur.news.totalViews} prev={prev.news.hasData ? prev.news.totalViews : null} />
        <KpiCard label="YouTube views" hint="Views video yang dipublish bulan ini, selama bulan ini." value={fmtNum(kpi.youtubeViews)} cur={cmp.youtubeViews?.[0] ?? null} prev={cmp.youtubeViews?.[1] ?? null} />
        <KpiCard
          label="Social views"
          hint="Views post yang dipublish bulan ini (Meta, lifetime)."
          value={fmtNum(cur.social.hasData ? cur.social.views : null)}
          cur={soc?.cur.views ?? null}
          prev={soc?.prev.views ?? null}
          emptyText={prev.social.hasData && !soc ? "Platform bulan lalu berbeda" : undefined}
        />
      </KpiGrid>
      {anyPartial && (
        <Notice>
          * MoM KPI gabungan hanya membandingkan komponen yang ada di {monthLabel(month)} dan {monthLabel(prevMonth(month))} (mis. platform sosmed yang sama).
        </Notice>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold">Kuota bulan ini</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuotaMini q={contentQuota(cur, "news")} prev={prev.news.hasData ? contentQuota(prev, "news") : null} href={`/news?m=${month}`} />
          <QuotaMini q={contentQuota(cur, "youtube")} prev={prev.youtube.hasData ? contentQuota(prev, "youtube") : null} href={`/youtube?m=${month}`} />
          <QuotaMini q={contentQuota(cur, "social")} prev={prev.social.hasData ? contentQuota(prev, "social") : null} href={`/social?m=${month}`} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Website" subtitle="Users & sessions · 6 bulan terakhir">
          <TrendChart data={labels} series={[{ key: "websiteUsers", name: "Users" }, { key: "websiteSessions", name: "Sessions" }]} />
        </Section>
        <Section title="News" subtitle="Views · 6 bulan terakhir">
          <TrendChart data={labels} series={[{ key: "newsViews", name: "Views" }]} />
        </Section>
        <Section title="YouTube" subtitle="Views · 6 bulan terakhir">
          <TrendChart data={labels} series={[{ key: "ytViews", name: "Views" }]} />
        </Section>
        <Section title="Social media" subtitle={`Views · 6 bulan terakhir${socialMixed ? " · per platform" : ""}`}>
          <TrendChart
            data={labels}
            series={socialMixed ? [{ key: "viewsInstagram", name: "Instagram" }, { key: "viewsFacebook", name: "Facebook" }] : [{ key: "socialViews", name: "Views" }]}
          />
        </Section>
      </div>

      <Recommendations items={recs} />
    </div>
  );
}
