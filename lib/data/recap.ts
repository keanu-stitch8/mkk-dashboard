// "MKK 2026 in numbers": rekap tahunan untuk presentasi divisi. Semua angka dijumlah per bulan dari data yang sama
// dengan halaman lain; views dijumlah (bisa ditambah), followers memakai angka akhir periode, bukan dijumlah.
import { prisma } from "../db";
import { LAUNCH_MONTH, addMonths, currentMonth } from "../month";
import { articleKey } from "../team/store";
import { ASSETS } from "../team/contributors";
import { getAudience, getTrend } from "./summary";
import { getScorecard } from "./scorecard";

export async function getRecap(year: string) {
  const first = `${year}-01` < LAUNCH_MONTH ? LAUNCH_MONTH : `${year}-01`;
  const last = [`${year}-12`, currentMonth()].sort()[0];
  const months: string[] = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) months.push(m);
  const inYear = { gte: first, lte: last };

  const [stories, guides, contributor, articles, briefs, social, trend, audStart, audEnd] = await Promise.all([
    prisma.story.findMany({ where: { month: inYear }, select: { month: true } }),
    prisma.story.findMany({ where: { month: inYear }, distinct: ["fileId"], select: { fileId: true } }),
    prisma.contributorTask.findMany({ where: { tab: inYear } }),
    prisma.newsArticle.findMany({ where: { month: inYear, status: "publish", import: { source: "news_log" } }, select: { month: true, title: true, url: true, date: true } }),
    prisma.brief.findMany({ where: { month: inYear }, select: { month: true, type: true } }),
    prisma.socialLog.findMany({ where: { month: inYear, status: "publish", platform: { contains: "instagram" } }, select: { month: true, format: true } }),
    getTrend(last, months.length),
    getAudience(first),
    getAudience(last),
  ]);

  // satu artikel dihitung sekali walau tercatat di dua baris
  const seen = new Set<string>();
  const uniqueArticles = articles.filter((a) => !seen.has(articleKey(a)) && seen.add(articleKey(a)));
  const assetsDelivered = contributor.reduce((n, t) => n + ASSETS.filter((a) => t[a.key] === "available").length, 0);

  const perMonth = await Promise.all(
    months.map(async (m) => {
      const t = trend.find((x) => x.month === m);
      const ig = social.filter((s) => s.month === m);
      // repurpose: snapshot jika bulan sudah final, selain itu hitungan live (bulan sebelum data tim: kosong)
      const score = m >= "2026-07" ? (await getScorecard(m)).scores.find((s) => s.key === "repurpose") : undefined;
      return {
        month: m,
        stories: stories.filter((s) => s.month === m).length,
        articles: uniqueArticles.filter((a) => a.month === m).length,
        briefs: briefs.filter((b) => b.month === m).length,
        feeds: ig.filter((s) => s.format === "feeds" || s.format === "carousel").length,
        reels: ig.filter((s) => s.format === "reels").length,
        igStories: ig.filter((s) => s.format === "story").length,
        youtube: t?.ytPublished ?? null,
        views: [t?.pageviews, t?.socialViews, t?.ytViews].every((v) => v == null) ? null : (t?.pageviews ?? 0) + (t?.socialViews ?? 0) + (t?.ytViews ?? 0),
        repurpose: score?.value ?? null,
        repurposeN: score?.n ?? null,
        repurposeBase: score?.base ?? null,
      };
    }),
  );

  const sum = (k: "stories" | "articles" | "briefs" | "feeds" | "reels" | "igStories") => perMonth.reduce((n, r) => n + r[k], 0);
  const sumNullable = (k: "youtube" | "views") => (perMonth.every((r) => r[k] == null) ? null : perMonth.reduce((n, r) => n + (r[k] ?? 0), 0));
  // repurpose setahun = Σ artikel yang diturunkan ÷ Σ artikel (bulan dengan data tim)
  const withRep = perMonth.filter((r) => r.repurposeN != null && r.repurposeBase != null);

  return {
    year,
    first,
    last,
    months: perMonth,
    totals: {
      guides: guides.length,
      stories: sum("stories"),
      contributorStories: contributor.length,
      assetsDelivered,
      articles: sum("articles"),
      briefs: sum("briefs"),
      carouselBriefs: briefs.filter((b) => b.type === "carousel").length,
      reelBriefs: briefs.filter((b) => b.type === "reel").length,
      feeds: sum("feeds"),
      reels: sum("reels"),
      igStories: sum("igStories"),
      youtube: sumNullable("youtube"),
      views: sumNullable("views"),
      repurposed: withRep.reduce((n, r) => n + r.repurposeN!, 0),
      repurposeBase: withRep.reduce((n, r) => n + r.repurposeBase!, 0),
      /** bulan pertama yang punya data tim (panduan, brief) */
      teamSince: withRep[0]?.month ?? null,
    },
    followers: { start: audStart.instagram.value, end: audEnd.instagram.value, startEstimated: audStart.instagram.estimated },
    subscribers: { start: audStart.youtube.value, end: audEnd.youtube.value },
    websiteReaders: audEnd.cumulativeUsers,
  };
}

export type Recap = Awaited<ReturnType<typeof getRecap>>;
