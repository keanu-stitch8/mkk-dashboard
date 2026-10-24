import type { SocialSummary } from "../types/social-summary";
import { socialQuota } from "./social-quota";

export type SocialTrendFields = {
  socialReach: number | null;
  /** per platform supaya bulan IG vs bulan FB tidak terbaca sebagai naik/turun */
  reachInstagram: number | null;
  reachFacebook: number | null;
  socialInteractions: number | null;
  socialPosts: number | null;
  socialQuotaCount: number | null;
  socialDelivered: number | null;
  socialQuota: number;
  socialViews: number | null;
  viewsInstagram: number | null;
  viewsFacebook: number | null;
  socialEr: number | null;
};

export function socialTrendFields(s: SocialSummary): SocialTrendFields {
  const q = socialQuota(s);
  return {
    socialReach: s.hasData ? s.reach : null,
    reachInstagram: s.byPlatform.find((p) => p.platform === "instagram")?.reach ?? null,
    reachFacebook: s.byPlatform.find((p) => p.platform === "facebook")?.reach ?? null,
    socialInteractions: s.hasData ? s.interactions : null,
    socialPosts: s.hasData ? s.postsPublished : null,
    socialQuotaCount: s.hasData ? q.published : null,
    socialDelivered: s.hasData ? q.achieved : null,
    socialQuota: q.target,
    socialViews: s.hasData ? s.views : null,
    viewsInstagram: s.byPlatform.find((p) => p.platform === "instagram")?.views ?? null,
    viewsFacebook: s.byPlatform.find((p) => p.platform === "facebook")?.views ?? null,
    socialEr: s.engagementRate,
  };
}
