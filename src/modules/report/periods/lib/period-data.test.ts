import { describe, expect, it } from "vitest";
import { buildPeriodData, completeTotal, periodCategories, periodPosts } from "./period-data";
import { reportPeriod } from "./period";
import { monthFixtures, postFixture } from "./period-test-fixture";
import type { PeriodMediaSnapshot } from "../types/period-report";

describe("metrics on the period's final calendar day", () => {
  const end: PeriodMediaSnapshot = { mediaId: "post-1", date: "2026-10-31", views: 17000, reach: 11059, likes: 248, comments: 19, shares: 284, saves: 276, follows: null };
  it("replaces the whole metric group with the month-end snapshot, ignoring adjacent dates", () => {
    const rows = periodPosts(reportPeriod(1), [postFixture()], [{ ...end, date: "2026-10-30", views: 16446 }, end, { ...end, date: "2026-11-02", follows: 277, views: 19000 }]);
    expect(rows[0]).toMatchObject({ capturedOn: "2026-10-31", views: 17000, follows: null, shares: 284 });
  });
  it("keeps a frozen month-end row and excludes posts outside the window", () => {
    const frozen = postFixture({ capturedOn: "2026-10-31", date: "2026-08-16", follows: 235 });
    expect(periodPosts(reportPeriod(1), [frozen], [])[0]).toEqual(frozen);
    expect(periodPosts(reportPeriod(1), [frozen], [end])[0]).toEqual(frozen);
    expect(periodPosts(reportPeriod(1), [postFixture({ date: "2026-11-01" }), postFixture({ date: "2026-06-30" })], [end])).toEqual([]);
  });
  it("leaves missing month-end metrics unavailable even when earlier and later snapshots exist", () => {
    const early = postFixture({ capturedOn: "2026-10-30", views: 16446 });
    const rows = periodPosts(reportPeriod(1), [early], [{ ...end, date: "2026-10-30" }, { ...end, date: "2026-11-02" }]);
    expect(rows[0]).toMatchObject({ capturedOn: null, views: null, reach: null, follows: null, profileVisits: null });
    const months = monthFixtures();
    months[3].posts = [early];
    const data = buildPeriodData(reportPeriod(1), months, [], "2026-11-05");
    expect(data.caseStudy).toBeNull();
    expect(data.topPosts).toEqual([]);
    expect(data.caseCandidates).toEqual([]);
    expect(data.blockedReasons).toEqual([]);
    expect(data.warnings.join(" ")).toContain("Top posts and the case study are shown as n/a");
    expect(data.views).toBe(4000);
    expect(data.categories.every((category) => category.views == null)).toBe(true);
  });
  it("does not invent zero metrics or use snapshots from before publication", () => {
    expect(periodPosts(reportPeriod(1), [postFixture()], [])[0]).toMatchObject({ capturedOn: null, views: null, follows: null });
    expect(periodPosts(reportPeriod(1), [postFixture()], [{ ...end, date: "2026-10-21" }])[0].views).toBeNull();
    expect(periodPosts(reportPeriod(1), [postFixture()], [{ ...end, views: 0 }])[0].views).toBe(0);
  });
});

describe("period aggregation", () => {
  it("uses the explicitly approved 2 November snapshot without changing July–October account totals", () => {
    const months = monthFixtures();
    months[3].posts.push(postFixture({ postId: "outside", date: "2026-11-01" }));
    const early = { ...monthEndSnapshot(), date: "2026-10-30", views: 16446 };
    const chosen = { ...monthEndSnapshot(), date: "2026-11-02", views: 18432 };
    const later = { ...chosen, date: "2026-11-05", views: 19344 };
    const data = buildPeriodData(reportPeriod(1), months, [early, chosen, later], "2026-11-05", {}, "2026-11-02");
    expect(data).toMatchObject({ postSnapshotDate: "2026-11-02", views: 4000, closingFollowers: 1400, blockedReasons: [] });
    expect(data.caseStudy).toMatchObject({ views: 18432, capturedOn: "2026-11-02" });
    expect(data.topPosts.map((post) => post.postId)).toEqual(["post-1"]);
    expect(data.warnings.join(" ")).toContain("not 2026-10-31");
    expect(data.warnings.join(" ")).toContain("after the reporting period");
    const missing = buildPeriodData(reportPeriod(1), months, [early, later], "2026-11-05", {}, "2026-11-02");
    expect(missing.caseStudy).toBeNull();
  });
  it("allows a completed report with account data but no post snapshots, even when CSV follows exist", () => {
    const rows = monthFixtures();
    rows[3].posts = [postFixture({ followsCsv: { postId: "post-1", follows: 278, observedOn: null, importedOn: "2026-11-05" } })];
    const data = buildPeriodData(reportPeriod(1), rows, [], "2026-11-05");
    expect(data).toMatchObject({ views: 4000, published: 320, closingFollowers: 1400, blockedReasons: [], caseStudy: null, caseCandidates: [], topPosts: [] });
    expect(data.posts[0]).toMatchObject({ views: null, capturedOn: null, follows: 278 });
    expect(() => buildPeriodData(reportPeriod(1), rows, [], "2026-11-05", { casePostId: "post-1" })).toThrow("top 10");
  });
  it("only overlays CSV follows after snapshot selection and preserves provenance and historical metrics", () => {
    const rows = monthFixtures();
    rows[3].posts = [postFixture({ follows: null, followsCsv: { postId: "post-1", follows: 278, observedOn: null, importedOn: "2026-11-05" } })];
    const data = buildPeriodData(reportPeriod(1), rows, [monthEndSnapshot()], "2026-11-05");
    expect(data.caseStudy).toMatchObject({ views: 17000, reach: 11059, shares: 284, follows: 278, profileVisits: null, capturedOn: "2026-10-31", followsCsv: { importedOn: "2026-11-05", observedOn: null } });
    expect(data.warnings.join(" ")).toContain("export date unknown");
  });
  it("keeps an available in-period follow count rather than replacing it with CSV", () => {
    const rows = monthFixtures();
    rows[3].posts[0].follows = 235;
    rows[3].posts[0].followsCsv = { postId: "post-1", follows: 250, observedOn: null, importedOn: "2026-11-05" };
    const data = buildPeriodData(reportPeriod(1), rows, [], "2026-11-05");
    expect(data.caseStudy).toMatchObject({ follows: 235, followsCsv: null });
  });
  it("keeps dashboard quota counts including Stories and reconciles opening followers", () => {
    const d = buildPeriodData(reportPeriod(1), monthFixtures(), [], "2026-11-05");
    expect(d).toMatchObject({ published: 320, stories: 200, feedAndReels: 120, quota: 240, views: 4000, profileVisits: 400, linkTaps: 8, closingFollowers: 1400, openingFollowers: 1000, netFollows: 400, nonFollowerViewShare: 0.75 });
    expect(d.linkTapRate).toBe(0.02);
    expect(d.blockedReasons).toEqual([]);
  });
  it("does not replace missing totals with zero or average monthly percentages", () => {
    const rows = monthFixtures();
    rows[0].views = null;
    rows[0].nonFollowerViews = 0;
    rows[0].splitViews = 100;
    const d = buildPeriodData(reportPeriod(1), rows, [], "2026-11-05");
    expect(d.views).toBeNull();
    expect(d.nonFollowerViewShare).toBeCloseTo(2250 / 3100);
    expect(completeTotal([0, 5])).toBe(5);
    expect(completeTotal([null, 5])).toBeNull();
    expect(completeTotal([])).toBeNull();
  });
  it("blocks incomplete periods and missing account months", () => {
    const rows = monthFixtures(2); rows[2].hasAccountData = false;
    const d = buildPeriodData(reportPeriod(2), rows, [], "2026-11-05");
    expect(d.blockedReasons).toHaveLength(2);
    expect(() => buildPeriodData(reportPeriod(1), [], [], "2026-11-05")).toThrow();
    expect(() => buildPeriodData(reportPeriod(1), monthFixtures(), [], "2026-11-05", { casePostId: "outside" })).toThrow();
  });
  it("recalculates grouped categories from the same captured post metrics", () => {
    const rows = periodCategories([postFixture({ views: 100, category: "Teaser" }), postFixture({ postId: "2", views: 50, category: "Teaser Recap" }), postFixture({ postId: "3", views: null, category: "Featured News" })]);
    expect(rows).toEqual([{ label: "Teaser", posts: 2, recordedPosts: 2, views: 150, avgViews: 75 }, { label: "Featured News", posts: 1, recordedPosts: 0, views: null, avgViews: null }]);
  });
  it("reports partial category coverage and averages only posts with recorded views", () => {
    const rows = periodCategories([postFixture({ views: 100 }), postFixture({ postId: "2", views: null }), postFixture({ postId: "3", views: 0 })]);
    expect(rows).toEqual([{ label: "Featured News", posts: 3, recordedPosts: 2, views: 100, avgViews: 50 }]);
  });
  it("limits cases to the current period's top 10 and rejects other periods or lower-ranked posts", () => {
    const months = monthFixtures(2);
    months[0].posts = Array.from({ length: 12 }, (_, i) => postFixture({ postId: `p2-${i}`, date: "2026-11-10", capturedOn: "2027-02-28", views: 1200 - i * 100 }));
    months[1].posts = [postFixture({ postId: "old-period", date: "2026-10-22", capturedOn: "2026-10-30", views: 1e6 })];
    months[3].posts = [];
    const data = buildPeriodData(reportPeriod(2), months, [], "2027-03-05");
    expect(data.caseCandidates).toHaveLength(10);
    expect(data.caseCandidates.map((post) => post.postId)).toEqual(Array.from({ length: 10 }, (_, i) => `p2-${i}`));
    for (const casePostId of ["old-period", "p2-11"]) expect(() => buildPeriodData(reportPeriod(2), months, [], "2027-03-05", { casePostId })).toThrow("top 10");
    expect(buildPeriodData(reportPeriod(2), months, [], "2027-03-05", { casePostId: "p2-9" }).caseStudy?.postId).toBe("p2-9");
  });
});

function monthEndSnapshot(): PeriodMediaSnapshot {
  return { mediaId: "post-1", date: "2026-10-31", views: 17000, reach: 11059, likes: 248, comments: 19, shares: 284, saves: 276, follows: null };
}
