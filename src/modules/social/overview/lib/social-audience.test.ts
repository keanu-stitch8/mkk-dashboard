import { describe, expect, it } from "vitest";
import { buildDiscovery, followerSeries, followFlows } from "./social-audience";

const flows = [
  { month: "2026-08", follows: 688, unfollows: 29 },
  { month: "2026-09", follows: 578, unfollows: 26 },
  { month: "2026-10", follows: 623, unfollows: 35 },
  { month: "2026-11", follows: 40, unfollows: 2 },
];

describe("followerSeries", () => {
  it("bulan berjalan = snapshot terakhir; bulan lalu dari snapshot + follow sejak tgl 1; sebelumnya hitung mundur", () => {
    const snaps = [
      { date: "2026-11-03", followers: 2250, monthFollows: 20, monthUnfollows: 1 },
      { date: "2026-11-04", followers: 2273, monthFollows: 44, monthUnfollows: 2 },
    ];
    const s = followerSeries(["2026-08", "2026-09", "2026-10", "2026-11"], snaps, flows, "2026-11-04");
    // Okt = snapshot pertama Nov (3 Nov) − (20 − 1) → estimate karena bukan tanggal 1
    expect(s.map((p) => [p.month, p.followers, p.basis])).toEqual([
      ["2026-08", 2231 - (623 - 35) - (578 - 26), "estimate"],
      ["2026-09", 2231 - (623 - 35), "estimate"],
      ["2026-10", 2231, "estimate"],
      ["2026-11", 2273, "measured"],
    ]);
    expect(s[3]).toMatchObject({ asOf: "2026-11-04", net: 38, label: "Nov 26" });
    expect(s[2]).toMatchObject({ asOf: null, net: 588 });
  });

  it("snapshot tanggal 1 / hari terakhir bulan = measured", () => {
    const snaps = [
      { date: "2026-09-30", followers: 1700, monthFollows: null, monthUnfollows: null },
      { date: "2026-11-01", followers: 2240, monthFollows: 3, monthUnfollows: 0 },
    ];
    const s = followerSeries(["2026-09", "2026-10"], snaps, flows, "2026-11-10");
    expect(s.map((p) => [p.followers, p.basis])).toEqual([
      [1700, "measured"],
      [2237, "measured"],
    ]);
  });

  it("rantai putus → null, bukan tebakan", () => {
    // snapshot tanpa follow sejak tgl 1, dan flow bulan berjalan tidak boleh dipakai hitung mundur
    const snaps = [{ date: "2026-11-04", followers: 2273, monthFollows: null, monthUnfollows: null }];
    const s = followerSeries(["2026-09", "2026-10", "2026-11"], snaps, flows, "2026-11-04");
    expect(s.map((p) => [p.followers, p.basis])).toEqual([
      [null, null],
      [null, null],
      [2273, "measured"],
    ]);
    // snapshot setelah "today" diabaikan; bulan sebelum peluncuran tidak dihitung
    expect(followerSeries(["2026-05", "2026-11"], snaps, flows, "2026-11-03").map((p) => p.followers)).toEqual([null, null]);
  });
});

describe("buildDiscovery", () => {
  const rows = [
    { metric: "profile_views", segment: "all", value: 2159 },
    { metric: "website_clicks", segment: "all", value: 64 },
    { metric: "reposts", segment: "all", value: 192 },
    { metric: "views", segment: "all", value: 144233 },
    { metric: "views", segment: "follower", value: 34426 },
    { metric: "views", segment: "non_follower", value: 109589 },
    { metric: "views", segment: "unknown", value: 218 },
    { metric: "reach", segment: "all", value: 48408 },
    { metric: "reach", segment: "follower", value: 1698 },
    { metric: "reach", segment: "non_follower", value: 46871 },
  ];

  it("metrik akun, porsi non-follower dari jumlah segmen, follows per 1.000 views", () => {
    const d = buildDiscovery(rows, 623)!;
    expect(d).toMatchObject({ profileVisits: 2159, linkTaps: 64, reposts: 192, likes: null });
    expect(d.views).toMatchObject({ follower: 34426, nonFollower: 109589, unknown: 218 });
    expect(d.views!.nonFollowerShare).toBeCloseTo(109589 / 144233, 6);
    // reach unik: segmen dijumlah (48.569) ≠ total 48.408 → porsi tetap ≤ 100%
    expect(d.reach!.nonFollowerShare).toBeCloseTo(46871 / (1698 + 46871), 6);
    expect(d.followsPer1kViews).toBeCloseTo((623 / 144233) * 1000, 6);
  });

  it("tanpa data → null; tanpa views → follows per 1.000 views null", () => {
    expect(buildDiscovery([], 10)).toBeNull();
    expect(buildDiscovery([{ metric: "profile_views", segment: "all", value: 5 }], 10)).toMatchObject({ followsPer1kViews: null, views: null, reach: null });
  });
});

describe("followFlows", () => {
  it("hanya bulan dengan follow & unfollow", () => {
    const rows = [
      { month: "2026-10", key: "ig_account_unfollows", value: 35 },
      { month: "2026-10", key: "ig_account_follows", value: 623 },
      { month: "2026-05", key: "ig_account_follows", value: 9 },
    ];
    expect(followFlows(rows)).toEqual([{ month: "2026-10", follows: 623, unfollows: 35 }]);
  });
});
