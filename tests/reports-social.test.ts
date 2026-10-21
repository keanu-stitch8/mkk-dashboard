import { describe, expect, it } from "vitest";
import { formatLabel, postTitle, reviewItem, socCategorySlots, SOC_CATEGORY_SLOTS } from "../lib/reports/channels/social";
import { socialFindings, type SocialNarrativeInput } from "../lib/reports/channels/social-narrative";
import { kpiData, SOCIAL_KPIS, type SocialKpiSource } from "../lib/reports/kpi";

// angka September 2026 (dashboard Social, Instagram)
const sep: SocialNarrativeInput = {
  monthLabel: "September 2026",
  prevMonthLabel: "August 2026",
  quota: 60,
  published: 55,
  inReview: 5,
  delivered: 60,
  prevPublished: 159,
  formats: [
    { label: "Feeds", count: 10, prevCount: 14 },
    { label: "Reels", count: 16, prevCount: 14 },
    { label: "Stories", count: 28, prevCount: 130 },
    { label: "Videos", count: 1, prevCount: 1 },
  ],
  top: [
    { title: "6 Soto Kudus", views: 20895 },
    { title: "Panggung Talenta Pelajar Kudus", views: 12610 },
    { title: "Lainnya", views: 72806 },
  ],
  formatViews: [
    { label: "Feeds", posts: 10, avgViews: 5541.8 },
    { label: "Reels", posts: 16, avgViews: 3064 },
  ],
  categoryViews: [
    { label: "Featured News", posts: 10, avgViews: 5541.8 },
    { label: "Featured Video", posts: 15, avgViews: 3100 },
  ],
  topFollows: { title: "6 Soto Kudus", follows: 212 },
};

describe("social narrative", () => {
  it("September: penurunan jumlah post dijelaskan oleh Stories; kategori = format tidak diulang", () => {
    expect(socialFindings(sep)).toEqual([
      "All 60 planned posts were delivered (55 live, 5 waiting for approval).",
      "Fewer posts went out than in August (55 against 159), mainly because of Stories (130 in August, 28 now); the other formats were similar (27 against 29).",
      "Stories made up just over half of the output (28), followed by Reels (16), Feeds (10) and Videos (1).",
      'The top post alone drew 20% of all views on this month\'s feed posts and Reels. The next best was "Panggung Talenta Pelajar Kudus" with 12.610 views.',
      "Feeds averaged 5.542 views per post, against 3.064 for Reels.",
      '"6 Soto Kudus" brought in the most new followers (212).',
    ]);
  });

  it("kategori berbeda dari format terbaik → disebut; kuota terlewati / kurang", () => {
    const f = socialFindings({ ...sep, published: 62, inReview: 0, delivered: 62, prevPublished: 60, categoryViews: [{ label: "Featured Video", posts: 4, avgViews: 9000 }] });
    expect(f[0]).toBe("62 posts were delivered against a quota of 60.");
    expect(socialFindings({ ...sep, published: 21, inReview: 1, delivered: 22 })[0]).toBe("22 of the 60 planned posts were delivered (21 live, 1 waiting for approval), 38 short of the quota.");
    expect(f).toContain("Featured Video posts were the most watched, with 9.000 views each on average across 4 posts.");
    expect(f.some((x) => x.startsWith("Fewer posts") || x.startsWith("More posts"))).toBe(false);
  });
});

describe("social report data", () => {
  it("format & judul post", () => {
    expect(formatLabel("story")).toBe("Story");
    expect(formatLabel("carousel")).toBe("Feed");
    expect(postTitle("  Batik Kudus  Dikenalkan ", null)).toBe("Batik Kudus Dikenalkan");
    expect(postTitle(null, "Padel dulu, ngopi kemudian. Padel makin digemari\nbaris dua")).toBe("Padel dulu, ngopi kemudian.");
  });
  it("label in review Task Progress → format laporan + judul", () => {
    expect(reviewItem("reels · Penginapan Rahtawu")).toEqual({ format: "Reel", title: "Penginapan Rahtawu" });
    expect(reviewItem("carousel · (tanpa judul)")).toEqual({ format: "Feed", title: "(untitled)" });
  });
  it("kategori tak dikenal → peringatan, tanpa Other", () => {
    const warnings: string[] = [];
    const s = socCategorySlots(["Featured News", "featured video", "Event", null], warnings);
    expect(s).toHaveLength(SOC_CATEGORY_SLOTS);
    expect(s.some((x) => x.name === "Other")).toBe(false);
    expect(warnings).toHaveLength(2);
  });
  it("kartu KPI: delivered 'x / kuota', hari aktif 'n days'", () => {
    const cur: SocialKpiSource = { published: 55, delivered: 60, quota: { value: 60 }, views: 223903, viewsPerPost: 3937, reach: 56156, engagementRate: 0.1382, interactions: 7761, follows: 578, activeDays: 24 };
    const d = kpiData(SOCIAL_KPIS, cur, { ...cur, published: 159, delivered: 162, views: 218317, reach: null });
    expect(d.values["kpi.delivered.label"]).toBe("Delivered vs quota");
    expect(d.values["kpi.delivered.value"]).toBe("60 / 60");
    expect(d.values["kpi.delivered.change"]).toBe("↓ −63,0% vs last month");
    expect(d.values["kpi.active_days.value"]).toBe("24 days");
    expect(d.values["kpi.views.change"]).toBe("↑ +2,6% vs last month");
    // tidak sebanding (definisi beda) → tidak dibandingkan
    expect(d.values["kpi.reach.change"]).toBe("No data last month");
  });
});
