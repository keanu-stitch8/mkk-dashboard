// Engine rekomendasi rule-based.
// Tambah rule baru: push objek ke array RULES. Rule dengan `mom: true` hanya dijalankan
// jika data bulan sebelumnya untuk channel tersebut tersedia.
import type { MonthBundle } from "@/modules/channels/types/month-bundle";
import type { Channel } from "@/modules/shared/types/dataset";
import { fmtDate, fmtDuration, fmtNum, fmtPct, truncate } from "@/modules/shared/lib/format";
import { monthLabel } from "@/modules/shared/lib/month";
import { FORMAT_LABEL, PLATFORM_LABEL } from "@/modules/shared/lib/sources";

export type Priority = "tinggi" | "sedang" | "rendah";

export interface Recommendation {
  id: string;
  channel: Channel;
  priority: Priority;
  title: string;
  text: string;
}

export interface RuleContext {
  cur: MonthBundle;
  prev: MonthBundle | null;
}

interface Rule {
  id: string;
  channel: Channel;
  /** butuh data bulan sebelumnya */
  mom?: boolean;
  run: (ctx: RuleContext) => Omit<Recommendation, "id" | "channel">[] | Omit<Recommendation, "id" | "channel"> | null;
}

const pctChange = (cur: number | null | undefined, prev: number | null | undefined) =>
  cur == null || prev == null || prev === 0 ? null : (cur - prev) / prev;

const fmtChange = (r: number) => `${r > 0 ? "up" : "down"} ${fmtPct(Math.abs(r))}`;

const formatName = (platform: string, format: string) =>
  `${FORMAT_LABEL[format] ?? format} ${PLATFORM_LABEL[platform] ?? platform}`.trim();

/** Channel dianggap punya data bulan lalu? */
function hasPrev(ctx: RuleContext, channel: Channel): boolean {
  return !!ctx.prev?.[channel].hasData;
}

export const RULES: Rule[] = [
  // ─────────── Website / SEO ───────────
  {
    id: "gsc-impr-up-ctr-down",
    channel: "website",
    mom: true,
    run: ({ cur, prev }) => {
      const w = cur.website, p = prev!.website;
      const ri = pctChange(w.gscImpressions, p.gscImpressions);
      if (ri == null || ri <= 0 || w.gscCtr == null || p.gscCtr == null || w.gscCtr >= p.gscCtr) return null;
      return {
        priority: "tinggi",
        title: "Impressions up, CTR down",
        text: `Google impressions are ${fmtChange(ri)} (${fmtNum(p.gscImpressions)} → ${fmtNum(w.gscImpressions)}), but CTR fell from ${fmtPct(p.gscCtr)} to ${fmtPct(w.gscCtr)}. Optimize the title tags and meta descriptions of the highest-impression pages so they're more clickable.`,
      };
    },
  },
  {
    id: "gsc-striking-distance",
    channel: "website",
    run: ({ cur }) => {
      const qs = cur.website.opportunityQueries.filter((q) => q.impressions >= 5).slice(0, 3);
      if (!qs.length) return null;
      const list = qs.map((q) => `"${q.query}" (position ${fmtNum(q.position, 1)}, ${fmtNum(q.impressions)} impressions)`).join(", ");
      return {
        priority: "sedang",
        title: "Queries in positions 4–10: a chance to reach the top 3",
        text: `${cur.website.opportunityQueries.length} queries rank in positions 4–10, e.g. ${list}. Strengthen the related content (add subheadings containing the query, internal links from popular pages, refresh the copy) to move them into the top 3.`,
      };
    },
  },
  {
    id: "gsc-low-ctr-pages",
    channel: "website",
    run: ({ cur }) => {
      const pages = cur.website.lowCtrPages.slice(0, 3);
      if (!pages.length) return null;
      return {
        priority: "rendah",
        title: "Pages shown often but rarely clicked",
        text: `The pages ${pages.map((p) => `${p.path} (${fmtNum(p.impressions)} impressions, CTR ${fmtPct(p.ctr)})`).join(", ")} have a CTR below 2%. Rewrite their titles & meta descriptions.`,
      };
    },
  },
  {
    id: "web-er-drop",
    channel: "website",
    mom: true,
    run: ({ cur, prev }) => {
      const r = pctChange(cur.website.engagementRate, prev!.website.engagementRate);
      if (r == null || r > -0.1) return null;
      return {
        priority: "tinggi",
        title: "Website engagement rate down",
        text: `Website engagement rate is down ${fmtPct(-r)} MoM (${fmtPct(prev!.website.engagementRate)} → ${fmtPct(cur.website.engagementRate)}). Check the top landing pages: load speed, how well the content matches the traffic source, and CTAs to related articles.`,
      };
    },
  },
  {
    id: "web-traffic-change",
    channel: "website",
    mom: true,
    run: ({ cur, prev }) => {
      const r = pctChange(cur.website.sessions, prev!.website.sessions);
      if (r == null || Math.abs(r) < 0.2) return null;
      return {
        priority: r < 0 ? "sedang" : "rendah",
        title: r < 0 ? "Website sessions down significantly" : "Website sessions up significantly",
        text: `Website sessions are ${fmtChange(r)} (${fmtNum(prev!.website.sessions)} → ${fmtNum(cur.website.sessions)}). ${
          r < 0 ? "Compare traffic sources to see which channel declined." : "Identify the content/channels driving it and repeat the pattern."
        }`,
      };
    },
  },
  {
    id: "web-source-dependence",
    channel: "website",
    run: ({ cur }) => {
      const top = cur.website.sourceBreakdown[0];
      if (!top || top.share == null || top.share < 0.5) return null;
      return {
        priority: "rendah",
        title: "Traffic depends on a single source",
        text: `${fmtPct(top.share)} of sessions come from ${top.label}. Diversify: grow Organic Search through SEO and Organic Social through links in bio/stories.`,
      };
    },
  },

  // ─────────── News ───────────
  {
    id: "news-quota",
    channel: "news",
    run: ({ cur }) => {
      const n = cur.news;
      // kuota dinilai dari delivered (published + in review)
      if (!n.hasData || n.achievement == null || n.achievement >= 0.9) return null;
      const gap = Math.max(0, n.quota.value - n.delivered);
      return {
        priority: n.achievement < 0.7 ? "tinggi" : "sedang",
        title: "Article quota not met yet",
        text: `Delivered ${fmtNum(n.delivered)} of ${fmtNum(n.quota.value)} articles (${fmtPct(n.achievement)}): ${fmtNum(n.published)} published + ${fmtNum(n.inReview)} in review; ${fmtNum(gap)} short.${
          n.inReview ? ` Speed up approval of the ${fmtNum(n.inReview)} articles still in review so they publish sooner.` : ""
        }`,
      };
    },
  },
  {
    id: "news-best-category",
    channel: "news",
    run: ({ cur }) => {
      const cats = cur.news.byCategory.filter((c) => c.count >= 2 && c.perContent != null);
      if (cats.length < 2 || cur.news.viewsPerArticle == null) return null;
      const best = [...cats].sort((a, b) => b.perContent! - a.perContent!)[0];
      if (best.perContent! < cur.news.viewsPerArticle * 1.2) return null;
      return {
        priority: "sedang",
        title: `Category "${best.label}" performs best`,
        text: `The ${best.label} category averages ${fmtNum(best.perContent)} views per article (${fmtNum(best.count)} articles), above the overall average of ${fmtNum(cur.news.viewsPerArticle)}. Publish more in this category next month.`,
      };
    },
  },
  {
    id: "news-unmatched",
    channel: "news",
    run: ({ cur }) => {
      const n = cur.news;
      const out: Omit<Recommendation, "id" | "channel">[] = [];
      if (n.unmatched.length) {
        out.push({
          priority: "sedang",
          title: "Published articles not found in GA4",
          text: `${fmtNum(n.unmatched.length)} published articles don't match the views data (${n.unmatched
            .slice(0, 3)
            .map((a) => `"${truncate(a.title, 40)}"`)
            .join(", ")}${n.unmatched.length > 3 ? ", …" : ""}). Check the URLs in the log (typos, changed slugs) or make sure the GA4 Pages and screens export includes every row.`,
        });
      }
      if (n.zeroViews.length) {
        out.push({
          priority: "sedang",
          title: "Articles with 0 views",
          text: `${fmtNum(n.zeroViews.length)} published articles recorded 0 views. Redistribute them on social and add internal links.`,
        });
      }
      return out;
    },
  },
  {
    id: "news-empty-days",
    channel: "news",
    run: ({ cur }) => {
      const s = cur.news.emptyStreak;
      if (!cur.news.hasData || s.length < 4) return null;
      return {
        priority: "rendah",
        title: "Consecutive days without articles",
        text: `No articles were published for ${fmtNum(s.length)} days in a row (${fmtDate(s.from, false)}–${fmtDate(s.to, false)}). Keep a stock of evergreen articles to fill gaps.`,
      };
    },
  },
  {
    id: "news-views-drop",
    channel: "news",
    mom: true,
    run: ({ cur, prev }) => {
      const r = pctChange(cur.news.viewsPerArticle, prev!.news.viewsPerArticle);
      if (r == null || r > -0.15) return null;
      return {
        priority: "sedang",
        title: "Views per article down",
        text: `Views per article are ${fmtChange(r)} (${fmtNum(prev!.news.viewsPerArticle)} → ${fmtNum(cur.news.viewsPerArticle)}). Review this month's headlines and article distribution.`,
      };
    },
  },

  // ─────────── YouTube ───────────
  {
    id: "yt-low-ctr",
    channel: "youtube",
    run: ({ cur }) => {
      const y = cur.youtube;
      if (!y.hasData) return null;
      const out: Omit<Recommendation, "id" | "channel">[] = [];
      if (y.ctr != null && y.ctr < 0.04) {
        out.push({
          priority: "tinggi",
          title: "YouTube thumbnail CTR below 4%",
          text: `Channel impressions CTR is ${fmtPct(y.ctr, 2)} from ${fmtNum(y.impressions)} impressions. Test thumbnails with faces/large text and more specific titles.`,
        });
      }
      const low = y.lowCtrVideos.slice(0, 3);
      if (low.length) {
        out.push({
          priority: "sedang",
          title: "Videos with low thumbnail CTR",
          text: `${low.map((v) => `"${truncate(v.title, 40)}" (CTR ${fmtPct(v.ctr, 2)}, ${fmtNum(v.impressions)} impressions)`).join(", ")}. Replace these videos' thumbnails/titles.`,
        });
      }
      return out;
    },
  },
  {
    id: "yt-retention",
    channel: "youtube",
    run: ({ cur }) => {
      const vids = cur.youtube.videos.filter((v) => v.durationSec && v.avgViewDurationSec && v.views >= 30 && v.avgViewDurationSec / v.durationSec < 0.25);
      if (!vids.length) return null;
      const v = vids[0];
      return {
        priority: "rendah",
        title: "Low video retention",
        text: `"${truncate(v.title, 50)}" is watched for ${fmtDuration(v.avgViewDurationSec)} on average out of ${fmtDuration(v.durationSec)} (${fmtPct(v.avgViewDurationSec! / v.durationSec!)}). Strengthen the first 15 seconds and consider a shorter cut.`,
      };
    },
  },
  {
    id: "yt-quota",
    channel: "youtube",
    run: ({ cur }) => {
      const y = cur.youtube;
      if (!y.hasData || y.deliveredRate == null || y.deliveredRate >= 0.9) return null;
      return {
        priority: "sedang",
        title: "YouTube video quota not met yet",
        text: `Delivered ${fmtNum(y.delivered)} of ${fmtNum(y.quota.value)} videos (${fmtPct(y.deliveredRate)}): ${fmtNum(y.published)} published + ${fmtNum(y.inReview)} in review.${
          y.inReview ? ` Speed up approval of the ${fmtNum(y.inReview)} videos still in review so they go live sooner.` : ""
        }`,
      };
    },
  },
  {
    id: "yt-views-change",
    channel: "youtube",
    mom: true,
    run: ({ cur, prev }) => {
      const r = pctChange(cur.youtube.views, prev!.youtube.views);
      if (r == null || r > -0.2) return null;
      return {
        priority: "sedang",
        title: "YouTube views down",
        text: `YouTube views are ${fmtChange(r)} (${fmtNum(prev!.youtube.views)} → ${fmtNum(cur.youtube.views)}). Promote the videos with Shorts/Reels cut-downs and end screens.`,
      };
    },
  },

  // ─────────── Social ───────────
  {
    id: "social-quota",
    channel: "social",
    run: ({ cur }) => {
      const q = cur.social.quotaProgress[0];
      if (!cur.social.hasData || !q?.available || q.rate == null || q.rate >= 0.9) return null;
      const gap = Math.max(0, q.quota.value - q.count);
      return {
        priority: q.rate < 0.7 ? "tinggi" : "sedang",
        title: "Social post quota not met yet",
        text: `Delivered ${fmtNum(q.count)} of ${fmtNum(q.quota.value)} posts (${fmtPct(q.rate)}): ${fmtNum(q.published)} published + ${fmtNum(q.inReview)} in review; ${fmtNum(gap)} short.${
          q.inReview ? ` Speed up approval of the ${fmtNum(q.inReview)} items still in review so they go live sooner.` : ""
        }${
          cur.social.countSource === "meta" ? " Counted from the Meta export without Stories — import the Publishing Log for official numbers." : ""
        }`,
      };
    },
  },
  {
    id: "social-er-drop",
    channel: "social",
    mom: true,
    run: ({ cur, prev }) => {
      // bandingkan per platform supaya IG vs FB tidak tercampur
      const out: Omit<Recommendation, "id" | "channel">[] = [];
      for (const p of cur.social.byPlatform) {
        const q = prev!.social.byPlatform.find((x) => x.platform === p.platform);
        const r = pctChange(p.er, q?.er);
        if (r == null || r > -0.1) continue;
        out.push({
          priority: "tinggi",
          title: `${PLATFORM_LABEL[p.platform] ?? p.platform} engagement rate down`,
          text: `${PLATFORM_LABEL[p.platform] ?? p.platform} engagement rate is down ${fmtPct(-r)} MoM (${fmtPct(q!.er)} → ${fmtPct(p.er)}). Strengthen the hook in the first 3 seconds, prompt the audience to comment/save, and review posting times.`,
        });
      }
      return out;
    },
  },
  {
    id: "social-best-format",
    channel: "social",
    run: ({ cur }) => {
      const out: Omit<Recommendation, "id" | "channel">[] = [];
      for (const platform of cur.social.platforms) {
        const formats = cur.social.byFormat.filter((f) => f.platform === platform && f.posts >= 2 && f.avgReach != null);
        if (formats.length < 2) continue;
        const sorted = [...formats].sort((a, b) => b.avgReach! - a.avgReach!);
        const [best, worst] = [sorted[0], sorted[sorted.length - 1]];
        const ratio = best.avgReach! / Math.max(1, worst.avgReach!);
        if (ratio < 1.5) continue;
        out.push({
          priority: ratio >= 2 ? "sedang" : "rendah",
          title: `${formatName(platform, best.format)} far outperforms ${FORMAT_LABEL[worst.format] ?? worst.format}`,
          text: `Average reach for ${formatName(platform, best.format)} is ${fmtNum(best.avgReach)} per post vs ${formatName(platform, worst.format)} at ${fmtNum(worst.avgReach)} (${fmtNum(ratio, 1)}×). Post more ${FORMAT_LABEL[best.format] ?? best.format}; for ${FORMAT_LABEL[worst.format] ?? worst.format}, re-test the cover and caption.`,
        });
      }
      return out;
    },
  },
  {
    id: "social-best-category",
    channel: "social",
    run: ({ cur }) => {
      const cats = cur.social.byCategory.filter((c) => c.posts >= 2 && c.avgReach != null && !c.label.startsWith("("));
      if (cats.length < 2) return null;
      const best = [...cats].sort((a, b) => b.avgReach! - a.avgReach!)[0];
      return {
        priority: "rendah",
        title: `Social category "${best.label}" has the widest reach`,
        text: `The ${best.label} category averages ${fmtNum(best.avgReach)} reach per post (${fmtNum(best.posts)} posts). Post more content in this category.`,
      };
    },
  },
  {
    id: "social-empty-days",
    channel: "social",
    run: ({ cur }) => {
      const s = cur.social.emptyStreak;
      if (!cur.social.hasData || s.length < 3) return null;
      return {
        priority: s.length >= 5 ? "sedang" : "rendah",
        title: "Consecutive days without posts",
        text: `Nothing was posted for ${fmtNum(s.length)} days in a row (${fmtDate(s.from, false)}–${fmtDate(s.to, false)}). Active on ${fmtNum(cur.social.activeDays)} days in ${monthLabel(cur.month)}. Schedule backup content to keep a steady posting rhythm.`,
      };
    },
  },
];

const ORDER: Record<Priority, number> = { tinggi: 0, sedang: 1, rendah: 2 };

export function generateRecommendations(ctx: RuleContext): Recommendation[] {
  return runRules(RULES, ctx);
}

/**
 * Rekomendasi satu channel dari data channel itu saja (halaman channel tidak perlu memuat MonthBundle penuh).
 * Rule channel C hanya membaca `cur[C]` / `prev[C]` (+ `month`) — dijaga modules/channels/lib/channel-recommendations.test.ts.
 */
export function channelRecommendations<C extends Channel>(channel: C, ctx: { cur: Pick<MonthBundle, C | "month">; prev: Pick<MonthBundle, C | "month"> | null }): Recommendation[] {
  return runRules(
    RULES.filter((r) => r.channel === channel),
    ctx as unknown as RuleContext,
  );
}

function runRules(rules: Rule[], ctx: RuleContext): Recommendation[] {
  const out: Recommendation[] = [];
  for (const rule of rules) {
    if (!ctx.cur[rule.channel].hasData) continue;
    if (rule.mom && !hasPrev(ctx, rule.channel)) continue;
    let res;
    try {
      res = rule.run(ctx);
    } catch (e) {
      console.error(`Rule ${rule.id} failed:`, e);
      continue;
    }
    if (!res) continue;
    const list = Array.isArray(res) ? res : [res];
    list.forEach((r, i) => out.push({ ...r, id: list.length > 1 ? `${rule.id}-${i}` : rule.id, channel: rule.channel }));
  }
  return out.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
}
