import { ASSETS, type AssetKey } from "@/lib/team/contributors";
import { LAUNCH_MONTH, addMonths } from "@/lib/month";
import { articleKey } from "@/lib/team/store";
import type { TrendPoint } from "@/modules/channels/types/trend";
import type { Audience } from "@/modules/overview/types/audience";
import type { Score } from "../../scorecard/types/scorecard";
import type { Recap } from "../types/recap";

// "MKK 2026 in numbers": rekap tahunan untuk presentasi divisi. Semua angka dijumlah per bulan dari data yang sama
// dengan halaman lain; views dijumlah (bisa ditambah), followers memakai angka akhir periode, bukan dijumlah.

/** Bulan pertama (≥ launching) s/d bulan terakhir (≤ bulan berjalan) dalam tahun itu. */
export function recapRange(year: string, current: string) {
  const first = `${year}-01` < LAUNCH_MONTH ? LAUNCH_MONTH : `${year}-01`;
  const last = [`${year}-12`, current].sort()[0];
  const months: string[] = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) months.push(m);
  return { first, last, months };
}

export interface RecapInput {
  year: string;
  first: string;
  last: string;
  months: string[];
  stories: { month: string }[];
  guides: number;
  contributor: Record<AssetKey, string | null>[];
  articles: { month: string; title: string; url: string | null; date: string | null }[];
  briefs: { month: string; type: string }[];
  social: { month: string; format: string }[];
  trend: TrendPoint[];
  audStart: Audience;
  audEnd: Audience;
  /** skor repurpose per bulan (snapshot atau live); tidak ada untuk bulan sebelum data tim */
  repurposeOf: Map<string, Score | undefined>;
}

export function buildRecap(i: RecapInput): Recap {
  // satu artikel dihitung sekali walau tercatat di dua baris
  const seen = new Set<string>();
  const uniqueArticles = i.articles.filter((a) => !seen.has(articleKey(a)) && seen.add(articleKey(a)));
  const assetsDelivered = i.contributor.reduce((n, t) => n + ASSETS.filter((a) => t[a.key] === "available").length, 0);

  const perMonth = i.months.map((m) => {
    const t = i.trend.find((x) => x.month === m);
    const ig = i.social.filter((s) => s.month === m);
    const score = i.repurposeOf.get(m);
    return {
      month: m,
      stories: i.stories.filter((s) => s.month === m).length,
      articles: uniqueArticles.filter((a) => a.month === m).length,
      briefs: i.briefs.filter((b) => b.month === m).length,
      feeds: ig.filter((s) => s.format === "feeds" || s.format === "carousel").length,
      reels: ig.filter((s) => s.format === "reels").length,
      igStories: ig.filter((s) => s.format === "story").length,
      youtube: t?.ytPublished ?? null,
      views: [t?.pageviews, t?.socialViews, t?.ytViews].every((v) => v == null) ? null : (t?.pageviews ?? 0) + (t?.socialViews ?? 0) + (t?.ytViews ?? 0),
      repurpose: score?.value ?? null,
      repurposeN: score?.n ?? null,
      repurposeBase: score?.base ?? null,
    };
  });

  const sum = (k: "stories" | "articles" | "briefs" | "feeds" | "reels" | "igStories") => perMonth.reduce((n, r) => n + r[k], 0);
  const sumNullable = (k: "youtube" | "views") => (perMonth.every((r) => r[k] == null) ? null : perMonth.reduce((n, r) => n + (r[k] ?? 0), 0));
  // repurpose setahun = Σ artikel yang diturunkan ÷ Σ artikel (bulan dengan data tim)
  const withRep = perMonth.filter((r) => r.repurposeN != null && r.repurposeBase != null);

  return {
    year: i.year,
    first: i.first,
    last: i.last,
    months: perMonth,
    totals: {
      guides: i.guides,
      stories: sum("stories"),
      contributorStories: i.contributor.length,
      assetsDelivered,
      articles: sum("articles"),
      briefs: sum("briefs"),
      carouselBriefs: i.briefs.filter((b) => b.type === "carousel").length,
      reelBriefs: i.briefs.filter((b) => b.type === "reel").length,
      feeds: sum("feeds"),
      reels: sum("reels"),
      igStories: sum("igStories"),
      youtube: sumNullable("youtube"),
      views: sumNullable("views"),
      repurposed: withRep.reduce((n, r) => n + r.repurposeN!, 0),
      repurposeBase: withRep.reduce((n, r) => n + r.repurposeBase!, 0),
      teamSince: withRep[0]?.month ?? null,
    },
    followers: { start: i.audStart.instagram.value, end: i.audEnd.instagram.value, startEstimated: i.audStart.instagram.estimated },
    subscribers: { start: i.audStart.youtube.value, end: i.audEnd.youtube.value },
    websiteReaders: i.audEnd.cumulativeUsers,
  };
}
