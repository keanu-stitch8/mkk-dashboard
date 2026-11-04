import { addMonths, daysInMonth, LAUNCH_MONTH, monthLabel } from "@/modules/shared/lib/month";
import type { FollowerPoint, FollowerSnapshotEntry, FollowFlow, FollowSplit, IgAccountMonthEntry, SocialDiscovery } from "../types/social-audience";

/**
 * Followers per akhir bulan untuk `months`. API IG hanya memberi total "saat ini", jadi:
 *  1. bulan berjalan (bulan dari `today`) = snapshot terakhir (per tanggal);
 *  2. bulan lalu = snapshot hari terakhir bulan itu, atau snapshot pertama bulan berikutnya − follow/unfollow sejak
 *     tanggal 1 yang diambil bersama snapshot itu (tanggal 1 = measured, tanggal lain = estimate);
 *  3. selain itu dihitung mundur: akhir bulan berikutnya − (follow − unfollow) bulan berikutnya (estimate).
 * Rantai putus (tidak ada snapshot / flow) → null.
 */
export function followerSeries(months: string[], snapshots: FollowerSnapshotEntry[], flows: FollowFlow[], today: string): FollowerPoint[] {
  const cur = today.slice(0, 7);
  const first = [...months].sort()[0] ?? cur;
  const snaps = [...snapshots].filter((s) => s.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const inMonth = (m: string) => snaps.filter((s) => s.date.startsWith(m));
  const flowOf = (m: string) => flows.find((f) => f.month === m) ?? null;
  const net = (f: { follows: number | null; unfollows: number | null } | null) => (f && f.follows != null && f.unfollows != null ? f.follows - f.unfollows : null);

  const out = new Map<string, FollowerPoint>();
  const point = (m: string, followers: number | null, basis: FollowerPoint["basis"], asOf: string | null, n: number | null): FollowerPoint => ({
    month: m,
    label: monthLabel(m, true),
    followers,
    basis: followers == null ? null : basis,
    asOf,
    net: n,
  });

  for (let m = cur; m >= first && m >= LAUNCH_MONTH; m = addMonths(m, -1)) {
    if (m === cur) {
      const last = inMonth(m).at(-1);
      const n = net(flowOf(m)) ?? (last ? net({ follows: last.monthFollows, unfollows: last.monthUnfollows }) : null);
      out.set(m, point(m, last?.followers ?? null, "measured", last?.date ?? null, n));
      continue;
    }
    const next = addMonths(m, 1);
    const n = net(flowOf(m));
    const onLastDay = inMonth(m).find((s) => s.date === daysInMonth(m).at(-1));
    if (onLastDay) {
      out.set(m, point(m, onLastDay.followers, "measured", null, n));
      continue;
    }
    const firstNext = inMonth(next).find((s) => s.monthFollows != null && s.monthUnfollows != null);
    if (firstNext) {
      const v = firstNext.followers - (firstNext.monthFollows! - firstNext.monthUnfollows!);
      out.set(m, point(m, v, firstNext.date.endsWith("-01") ? "measured" : "estimate", null, n));
      continue;
    }
    // bulan berikutnya harus bulan yang sudah selesai (flow lengkap) supaya hitung mundur sah
    const after = out.get(next);
    const nextNet = next === cur ? null : net(flowOf(next));
    out.set(m, point(m, after?.followers != null && nextNet != null ? after.followers - nextNet : null, "estimate", null, n));
  }
  return months.map((m) => out.get(m) ?? point(m, null, null, null, net(flowOf(m))));
}

/** Baris Metric ig_account_follows / ig_account_unfollows → flow per bulan; hanya bulan yang punya keduanya (bulan CSV tidak). */
export function followFlows(rows: { month: string; key: string; value: number }[]): FollowFlow[] {
  const val = (m: string, key: string) => rows.find((r) => r.month === m && r.key === key)?.value;
  return [...new Set(rows.map((r) => r.month))].sort().flatMap((month) => {
    const follows = val(month, "ig_account_follows");
    const unfollows = val(month, "ig_account_unfollows");
    return follows != null && unfollows != null ? [{ month, follows, unfollows }] : [];
  });
}

function split(rows: IgAccountMonthEntry[], metric: string): FollowSplit | null {
  const of = (segment: string) => rows.find((r) => r.metric === metric && r.segment === segment)?.value ?? null;
  const follower = of("follower");
  const nonFollower = of("non_follower");
  if (follower == null && nonFollower == null) return null;
  const unknown = of("unknown") ?? 0;
  const total = (follower ?? 0) + (nonFollower ?? 0) + unknown;
  // reach unik: jumlah segmen ≠ total reach (akun bisa terhitung di dua segmen) → porsi dari jumlah segmen
  return { follower: follower ?? 0, nonFollower: nonFollower ?? 0, unknown, nonFollowerShare: total ? (nonFollower ?? 0) / total : null };
}

/** Insight akun tambahan satu bulan. null = bulan itu belum punya data IgAccountMonth. */
export function buildDiscovery(rows: IgAccountMonthEntry[], follows: number | null): SocialDiscovery | null {
  if (!rows.length) return null;
  const all = (metric: string) => rows.find((r) => r.metric === metric && r.segment === "all")?.value ?? null;
  const views = all("views");
  return {
    profileVisits: all("profile_views"),
    linkTaps: all("website_clicks"),
    likes: all("likes"),
    comments: all("comments"),
    shares: all("shares"),
    saves: all("saves"),
    reposts: all("reposts"),
    followsPer1kViews: follows != null && views ? (follows / views) * 1000 : null,
    views: split(rows, "views"),
    reach: split(rows, "reach"),
  };
}
