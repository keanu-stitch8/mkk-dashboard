import type { MonthBundle } from "@/modules/channels/types/month-bundle";
import { sum } from "@/modules/shared/lib/math";
import { socialComparable } from "@/modules/social/overview/lib/social-compare";

export interface OverviewKpis {
  totalReach: number | null;
  totalEngagement: number | null;
  websiteUsers: number | null;
  youtubeViews: number | null;
  articlesPublished: number | null;
  postsPublished: number | null;
}

type Pair = readonly [number, number] | null;

/** KPI gabungan: hanya komponen yang ada di kedua bulan; partial jika ada komponen tanpa pembanding. */
export interface CompositeComparison {
  cur: number;
  prev: number;
  partial: boolean;
}

export interface OverviewComparison {
  totalReach: CompositeComparison | null;
  totalEngagement: CompositeComparison | null;
  websiteUsers: Pair;
  youtubeViews: Pair;
  articlesPublished: Pair;
  postsPublished: Pair;
}

/** KPI lintas channel untuk Overview. */
export function overviewKpis(b: MonthBundle): OverviewKpis {
  const parts = [b.website.gscImpressions, b.youtube.impressions, b.social.reach];
  const engParts = [b.social.interactions, b.website.engagedSessions];
  return {
    totalReach: parts.every((p) => p == null) ? null : sum(parts),
    totalEngagement: engParts.every((p) => p == null) ? null : sum(engParts),
    websiteUsers: b.website.users,
    youtubeViews: b.youtube.hasData ? b.youtube.views : null,
    articlesPublished: b.news.hasData ? b.news.published : null,
    postsPublished: b.social.hasData ? b.social.postsPublished : null,
  };
}

/**
 * Nilai pembanding MoM untuk KPI overview. KPI gabungan hanya memakai komponen yang
 * ada di kedua bulan; null = tidak ada pembanding yang adil.
 */
export function overviewComparison(cur: MonthBundle, prev: MonthBundle): OverviewComparison {
  const soc = socialComparable(cur.social, prev.social);
  const pair = (a: number | null, b: number | null) => (a != null && b != null ? ([a, b] as const) : null);
  /** components: [nilai bulan ini, pasangan pembanding]; partial jika ada komponen tanpa pembanding */
  const composite = (components: [number | null, Pair][]) => {
    const ok = components.map((c) => c[1]).filter((p): p is readonly [number, number] => !!p);
    if (!ok.length) return null;
    return { cur: sum(ok.map((p) => p[0])), prev: sum(ok.map((p) => p[1])), partial: components.some((c) => c[0] != null && !c[1]) };
  };
  const ytImpr = cur.youtube.hasData ? cur.youtube.impressions : null;
  return {
    totalReach: composite([
      [cur.website.gscImpressions, pair(cur.website.gscImpressions, prev.website.gscImpressions)],
      [ytImpr, pair(ytImpr, prev.youtube.hasData ? prev.youtube.impressions : null)],
      [cur.social.reach, soc ? pair(soc.cur.reach, soc.prev.reach) : null],
    ]),
    totalEngagement: composite([
      [cur.social.interactions, soc ? pair(soc.cur.interactions, soc.prev.interactions) : null],
      [cur.website.engagedSessions, pair(cur.website.engagedSessions, prev.website.engagedSessions)],
    ]),
    websiteUsers: pair(cur.website.users, prev.website.users),
    youtubeViews: pair(cur.youtube.hasData ? cur.youtube.views : null, prev.youtube.hasData ? prev.youtube.views : null),
    articlesPublished: pair(cur.news.hasData ? cur.news.published : null, prev.news.hasData ? prev.news.published : null),
    postsPublished: soc ? ([soc.cur.posts, soc.prev.posts] as const) : null,
  };
}
