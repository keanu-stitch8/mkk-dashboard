import "server-only";
import type { Channel } from "@/modules/import/parsers/types";
import { audienceTotal, type AudienceKeys } from "../lib/audience";
import { findLatestMetric, findMetricHistory, findMonthMetric } from "../repositories/audience-repository";
import { getIgFollowers } from "@/modules/social/overview/services/social-audience-service";
import type { Audience, AudienceTotal } from "../types/audience";

async function getAudienceTotal(month: string, channel: Channel, keys: AudienceKeys, source?: string): Promise<AudienceTotal> {
  const [snap, flows] = await Promise.all([findLatestMetric(channel, keys.now, source), findMetricHistory(channel, [keys.gained, keys.lost], source)]);
  return audienceTotal(month, snap, flows, keys);
}

/** Followers IG: snapshot harian (IgFollowerSnapshot, sama dengan halaman Social); tanpa snapshot → metrik followersNow lama. */
async function getInstagramTotal(month: string): Promise<AudienceTotal> {
  const [legacy, point] = await Promise.all([
    getAudienceTotal(month, "social", { now: "ig_account_followersNow", gained: "ig_account_follows", lost: "ig_account_unfollows" }, "meta_instagram"),
    getIgFollowers(month),
  ]);
  return point.followers == null ? legacy : { ...legacy, value: point.followers, estimated: point.basis === "estimate" };
}

/** Kartu audiens Overview (semua kumulatif): total pembaca website (users unik GA4 sejak awal data), followers IG, subscriber YT. */
export async function getAudience(month: string): Promise<Audience> {
  const [cumulative, returning, users, instagram, youtube] = await Promise.all([
    findMonthMetric(month, "website", "cumulativeUsers"),
    findMonthMetric(month, "website", "returningUsers"),
    findMonthMetric(month, "website", "users"),
    getInstagramTotal(month),
    getAudienceTotal(month, "youtube", { now: "subscribersNow", gained: "subsGained", lost: "subsLost" }),
  ]);
  return { cumulativeUsers: cumulative?.value ?? null, returningUsers: returning?.value ?? null, websiteUsers: users?.value ?? null, instagram, youtube };
}
