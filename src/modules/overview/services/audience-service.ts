import "server-only";
import type { Channel } from "@/lib/parsers/types";
import { audienceTotal, type AudienceKeys } from "../lib/audience";
import { findLatestMetric, findMetricHistory, findMonthMetric } from "../repositories/audience-repository";
import type { Audience, AudienceTotal } from "../types/audience";

async function getAudienceTotal(month: string, channel: Channel, keys: AudienceKeys, source?: string): Promise<AudienceTotal> {
  const [snap, flows] = await Promise.all([findLatestMetric(channel, keys.now, source), findMetricHistory(channel, [keys.gained, keys.lost], source)]);
  return audienceTotal(month, snap, flows, keys);
}

/** Kartu audiens Overview (semua kumulatif): total pembaca website (users unik GA4 sejak awal data), followers IG, subscriber YT. */
export async function getAudience(month: string): Promise<Audience> {
  const [cumulative, returning, users, instagram, youtube] = await Promise.all([
    findMonthMetric(month, "website", "cumulativeUsers"),
    findMonthMetric(month, "website", "returningUsers"),
    findMonthMetric(month, "website", "users"),
    getAudienceTotal(month, "social", { now: "ig_account_followersNow", gained: "ig_account_follows", lost: "ig_account_unfollows" }, "meta_instagram"),
    getAudienceTotal(month, "youtube", { now: "subscribersNow", gained: "subsGained", lost: "subsLost" }),
  ]);
  return { cumulativeUsers: cumulative?.value ?? null, returningUsers: returning?.value ?? null, websiteUsers: users?.value ?? null, instagram, youtube };
}
