import "server-only";
import { prevMonth } from "@/modules/shared/lib/month";
import { trendMonths } from "@/modules/shared/lib/trend-months";
import { WIB, dateIn } from "@/modules/shared/lib/tz";
import { ACTIVE_SOCIAL_PLATFORMS } from "@/modules/shared/lib/sources";
import { findIgAccountMonths, findIgFollowerSnapshots, findIgFollowFlows } from "../../shared/repositories/social-repository";
import { buildDiscovery, followerSeries, followFlows } from "../lib/social-audience";
import type { FollowerPoint, SocialAudience } from "../types/social-audience";

/** Followers IG per akhir bulan (bulan berjalan: per snapshot terakhir) untuk bulan-bulan ini. */
async function followerPoints(months: string[]) {
  const [snapshots, flowRows] = await Promise.all([findIgFollowerSnapshots(), findIgFollowFlows()]);
  const flows = followFlows(flowRows);
  return { flows, series: followerSeries([...new Set(months)].sort(), snapshots, flows, dateIn(Date.now(), WIB)) };
}

/** Followers IG satu bulan — kartu audiens Overview (sama dengan halaman Social). */
export async function getIgFollowers(month: string): Promise<FollowerPoint> {
  return (await followerPoints([month])).series[0];
}

/**
 * Followers per akhir bulan + insight akun tambahan (profile visits, link bio, porsi non-follower) — halaman Social.
 * null jika Instagram bukan platform aktif.
 */
export async function getSocialAudience(month: string): Promise<SocialAudience | null> {
  if (!ACTIVE_SOCIAL_PLATFORMS.includes("instagram")) return null;
  const prev = prevMonth(month);
  const months = [...new Set([...trendMonths(month), prev, month])].sort();
  const [accountRows, { flows: complete, series }] = await Promise.all([findIgAccountMonths([month, prev]), followerPoints(months)]);
  const at = (m: string) => series.find((p) => p.month === m)!;
  const rowsOf = (m: string) => accountRows.filter((r) => r.month === m).map(({ metric, segment, value }) => ({ metric, segment, value }));
  const followsOf = (m: string) => complete.find((f) => f.month === m)?.follows ?? null;

  return {
    followers: at(month),
    prevFollowers: at(prev),
    series: series.filter((p) => trendMonths(month).includes(p.month)),
    discovery: buildDiscovery(rowsOf(month), followsOf(month)),
    prevDiscovery: buildDiscovery(rowsOf(prev), followsOf(prev)),
  };
}
