import type { SocialKpiSource } from "@/lib/reports/kpi";
import { safeDiv, sum } from "@/modules/shared/lib/math";
import type { SocialSummary } from "../types/social-summary";

export interface SocialComparableValues {
  posts: number;
  reach: number | null;
  views: number | null;
  postViews: number;
  interactions: number | null;
  follows: number | null;
  engagementRate: number | null;
}

export interface SocialComparable {
  platforms: string[];
  /** sebagian platform hanya ada di salah satu bulan */
  partial: boolean;
  cur: SocialComparableValues;
  prev: SocialComparableValues;
}

/**
 * Angka sosmed yang bisa dibandingkan antar bulan: hanya platform yang ada di kedua bulan
 * (mis. Agustus cuma IG dan September cuma FB → tidak ada pembanding).
 */
export function socialComparable(cur: SocialSummary, prev: SocialSummary | null): SocialComparable | null {
  if (!prev?.hasData || !cur.hasData) return null;
  const common = cur.platforms.filter((p) => prev.platforms.includes(p));
  if (!common.length) return null;
  // insight akun (selama bulan) vs jumlah lifetime per post: definisi beda → tidak dibandingkan
  const sameSource = cur.metricsSource === prev.metricsSource;
  const pick = (s: SocialSummary) => {
    const rows = s.byPlatform.filter((b) => common.includes(b.platform));
    const posts = s.posts.filter((p) => common.includes(p.platform));
    const account = s.metricsSource === "account";
    const reach = !sameSource ? null : account ? s.reach : sum(rows.map((r) => r.reach));
    const interactions = !sameSource ? null : account ? s.interactions : sum(rows.map((r) => r.interactions));
    return {
      posts: posts.length,
      reach,
      views: !sameSource ? null : account ? s.views : sum(rows.map((r) => r.views)),
      postViews: sum(posts.map((p) => p.views)),
      interactions,
      // follows per bulan hanya sebanding jika definisinya sama (insight akun vs jumlah per post)
      follows: cur.followsSource === prev.followsSource ? s.follows : null,
      engagementRate: reach == null || interactions == null ? null : safeDiv(interactions, reach),
    };
  };
  const partial = common.length < cur.platforms.length || common.length < prev.platforms.length;
  return { platforms: common, partial, cur: pick(cur), prev: pick(prev) };
}

/**
 * Sumber kartu KPI Social (dashboard & laporan, SOCIAL_KPIS): nilai bulan ini lengkap; bulan lalu hanya metrik yang
 * sebanding (aturan socialComparable — platform sama & definisi sama), selain itu null → tidak dibandingkan.
 */
export function socialKpiSources(cur: SocialSummary, prev: SocialSummary | null): { cur: SocialKpiSource; prev: SocialKpiSource | null; cmp: SocialComparable | null } {
  const cmp = socialComparable(cur, prev);
  const per = (v: number | null | undefined, n: number) => (v == null || !n ? null : v / n);
  const src = (s: SocialSummary): SocialKpiSource => ({
    published: s.postsPublished,
    delivered: s.quotaProgress[0].count,
    quota: s.quotaProgress[0].quota,
    views: s.views,
    viewsPerPost: per(s.postViews, s.posts.length),
    reach: s.reach,
    engagementRate: s.engagementRate,
    interactions: s.interactions,
    follows: s.follows,
    activeDays: s.activeDays,
  });
  const prevSrc = !prev?.hasData
    ? null
    : {
        ...src(prev),
        views: cmp?.prev.views ?? null,
        viewsPerPost: cmp ? per(cmp.prev.postViews, cmp.prev.posts) : null,
        reach: cmp?.prev.reach ?? null,
        engagementRate: cmp?.prev.engagementRate ?? null,
        interactions: cmp?.prev.interactions ?? null,
        follows: cmp?.prev.follows ?? null,
      };
  return { cur: src(cur), prev: prevSrc, cmp };
}
