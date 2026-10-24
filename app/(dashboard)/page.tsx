import Link from "next/link";
import { CircleCheck, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { ChartCard } from "@/components/ChartCard";
import { KpiCard, KpiGrid, Notice, QuotaMini } from "@/components/blocks";
import { Recommendations } from "@/components/Recommendations";
import { contentQuota, getAudience, getMonthAndPrev, getTrend, overviewComparison, overviewKpis, resolveMonth, socialComparable, type AudienceTotal } from "@/lib/data/summary";
import { generateRecommendations } from "@/lib/recommendations";
import { fmtNum } from "@/lib/format";
import { monthLabel, prevMonth } from "@/lib/month";

export const dynamic = "force-dynamic";

/** "+200 follow · −22 unfollow bulan ini" (+ tanda estimasi untuk total hasil hitung mundur). */
function audienceNote(a: AudienceTotal, gainedLabel: string, lostLabel: string) {
  if (a.gained == null || a.lost == null) return a.estimated ? "Estimated from the following month" : undefined;
  return `+${fmtNum(a.gained)} ${gainedLabel} · −${fmtNum(a.lost)} ${lostLabel} this month${a.estimated ? " · estimated" : ""}`;
}

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const { month, months } = await resolveMonth((await searchParams).m);
  const [{ cur, prev }, trend, aud, prevAud] = await Promise.all([getMonthAndPrev(month), getTrend(month), getAudience(month), getAudience(prevMonth(month))]);
  const kpi = overviewKpis(cur);
  const cmp = overviewComparison(cur, prev);
  const recs = generateRecommendations({ cur, prev });
  const labels = trend.map((t) => ({ ...t, label: monthLabel(t.month, true) }));

  const channels = [
    { key: "website", label: "Website", has: cur.website.hasData, href: "/website" },
    { key: "news", label: "News", has: cur.news.hasData, href: "/news" },
    { key: "social", label: "Social Media", has: cur.social.hasData, href: "/social" },
    { key: "youtube", label: "YouTube", has: cur.youtube.hasData, href: "/youtube" },
  ];
  const anyPartial = cmp.totalReach?.partial || cmp.totalEngagement?.partial;
  const soc = socialComparable(cur.social, prev.social);
  const socialMixed = trend.some((t) => t.viewsFacebook != null) && trend.some((t) => t.viewsInstagram != null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Overview" month={month} months={months} />

      <div className="flex flex-wrap gap-2">
        {channels.map((c) => (
          <Badge key={c.key} asChild variant="outline" className={c.has ? "" : "border-dashed text-muted-foreground"}>
            <Link href={c.has ? `${c.href}?m=${month}` : `/import?m=${month}`}>
              {c.has ? <CircleCheck className="text-success" /> : <CircleDashed />}
              {c.label}: {c.has ? "has data" : "not imported yet"}
            </Link>
          </Badge>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <QuotaMini q={contentQuota(cur, "news")} prev={prev.news.hasData ? contentQuota(prev, "news") : null} href={`/news?m=${month}`} />
        <QuotaMini q={contentQuota(cur, "social")} prev={prev.social.hasData ? contentQuota(prev, "social") : null} href={`/social?m=${month}`} />
        <QuotaMini q={contentQuota(cur, "youtube")} prev={prev.youtube.hasData ? contentQuota(prev, "youtube") : null} href={`/youtube?m=${month}`} />
      </div>

      <KpiGrid>
        <KpiCard
          label="Total readers"
          hint="Unique mainkekudus.com users since GA4 data started (Jun 23, 2026) through month end — cumulative, the website's equivalent of followers. Returning readers = GA4 returning users that month."
          value={fmtNum(aud.cumulativeUsers)}
          cur={aud.cumulativeUsers}
          prev={prevAud.cumulativeUsers}
          note={aud.returningUsers != null ? `${fmtNum(aud.returningUsers)} returning readers this month` : undefined}
        />
        <KpiCard
          label="Instagram followers"
          hint="Instagram account followers_count (Graph API) as of the current month's sync; earlier months are back-calculated from follows − unfollows each month (estimate)."
          value={fmtNum(aud.instagram.value)}
          cur={aud.instagram.value}
          prev={prevAud.instagram.value}
          note={audienceNote(aud.instagram, "follow", "unfollow")}
        />
        <KpiCard
          label="YouTube subscribers"
          hint="Channel subscribers (YouTube Data API, rounded to 3 significant digits) as of the current month's sync; earlier months are back-calculated from subscribers gained − lost (estimate)."
          value={fmtNum(aud.youtube.value)}
          cur={aud.youtube.value}
          prev={prevAud.youtube.value}
          note={audienceNote(aud.youtube, "gained", "lost")}
        />
        <KpiCard
          label="Total reach / impressions"
          value={fmtNum(kpi.totalReach)}
          cur={cmp.totalReach?.cur ?? null}
          prev={cmp.totalReach?.prev ?? null}
          partial={cmp.totalReach?.partial}
          hint="Google Search impressions + YouTube thumbnail impressions + social post reach (sum of reach per post)."
        />
        <KpiCard
          label="Total engagement"
          value={fmtNum(kpi.totalEngagement)}
          cur={cmp.totalEngagement?.cur ?? null}
          prev={cmp.totalEngagement?.prev ?? null}
          partial={cmp.totalEngagement?.partial}
          hint="Social interactions (likes/reactions + comments + shares + saves) + website engaged sessions."
        />
        <KpiCard label="Website users" value={fmtNum(kpi.websiteUsers)} cur={cmp.websiteUsers?.[0] ?? null} prev={cmp.websiteUsers?.[1] ?? null} note={cur.website.usersEstimated ? "Estimated (sum per city)" : undefined} />
        <KpiCard label="News views" hint="Views during this month of articles published this month." value={fmtNum(cur.news.totalViews)} cur={cur.news.totalViews} prev={prev.news.hasData ? prev.news.totalViews : null} />
        <KpiCard
          label="Social views"
          hint="Views of posts published this month (Meta, lifetime)."
          value={fmtNum(cur.social.hasData ? cur.social.views : null)}
          cur={soc?.cur.views ?? null}
          prev={soc?.prev.views ?? null}
          emptyText={prev.social.hasData && !soc ? "Last month used a different platform" : undefined}
        />
        <KpiCard label="YouTube views" hint="Views during this month of videos published this month." value={fmtNum(kpi.youtubeViews)} cur={cmp.youtubeViews?.[0] ?? null} prev={cmp.youtubeViews?.[1] ?? null} />
      </KpiGrid>
      {anyPartial && (
        <Notice>
          * Combined KPIs only compare MoM the components present in both {monthLabel(month)} and {monthLabel(prevMonth(month))} (e.g. the same social platforms).
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Website" description="Users & sessions" data={labels} series={[{ key: "websiteUsers", name: "Users" }, { key: "websiteSessions", name: "Sessions" }]} />
        <ChartCard title="News" description="Views" data={labels} series={[{ key: "newsViews", name: "Views" }]} />
        <ChartCard
          title="Social media"
          description={`Views${socialMixed ? " · per platform" : ""}`}
          data={labels}
          series={socialMixed ? [{ key: "viewsInstagram", name: "Instagram" }, { key: "viewsFacebook", name: "Facebook" }] : [{ key: "socialViews", name: "Views" }]}
        />
        <ChartCard title="YouTube" description="Views" data={labels} series={[{ key: "ytViews", name: "Views" }]} />
      </div>

      <Recommendations items={recs} />
    </div>
  );
}
