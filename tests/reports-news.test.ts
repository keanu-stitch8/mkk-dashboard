import { describe, expect, it } from "vitest";
import { categorySlots, NEWS_CATEGORY_SLOTS, sheetDate } from "../lib/reports/channels/news";
import { newsFindings, type NewsNarrativeInput } from "../lib/reports/channels/news-narrative";
import { kpiData, NEWS_KPIS, type NewsKpiSource } from "../lib/reports/kpi";

// angka September 2026 (dashboard News)
const sep: NewsNarrativeInput = {
  monthLabel: "September 2026",
  prevMonthLabel: "August 2026",
  quota: 60,
  published: 42,
  inReview: 11,
  delivered: 53,
  achievement: 53 / 60,
  prevAchievement: 43 / 60,
  totalViews: 1353,
  prevViews: 1306,
  viewsPerArticle: 1353 / 42,
  top: [
    { title: "Dari Tiga Orang Jadi Satu Lapangan", views: 135 },
    { title: "Wushu Indonesia Kudus", views: 102 },
    { title: "Berlian Sports Centre", views: 73 },
  ],
  byType: [
    { label: "Features", count: 20, views: 675, perContent: 33.75 },
    { label: "Editorial", count: 15, views: 532, perContent: 35.47 },
    { label: "Hard News", count: 7, views: 146, perContent: 20.86 },
  ],
  byCategory: [
    { label: "Komunitas", count: 7, views: 372 },
    { label: "Kegiatan", count: 11, views: 257 },
  ],
  activeDays: 20,
  daysInMonth: 30,
  emptyStreak: { length: 3, from: "2026-09-04", to: "2026-09-06" },
  matched: 42,
  publishedListed: 42,
};

describe("news narrative", () => {
  it("temuan September: kalimat pendek tanpa tanda pisah", () => {
    const f = newsFindings(sep);
    expect(f).toEqual([
      "53 of the 60 planned articles were delivered (88.3%), 7 short of the quota. 42 are published and 11 are still in review.",
      "Quota achievement rose 16.7 percentage points from August 2026.",
      "Articles published in September 2026 received 1,353 views, an average of 32.2 views per article.",
      "Views rose 3.6% from August 2026 (1,306 to 1,353).",
      'The next most read were "Wushu Indonesia Kudus" (102 views) and "Berlian Sports Centre" (73 views).',
      "Features made up the largest share with 20 articles (47.6%), while Editorial drew the most views per article (35.5).",
      "Komunitas was the most read category with 372 views from 7 articles.",
      "New articles went live on 20 of 30 days. The longest gap without a new article was 3 days (4 to 6 September).",
    ]);
    expect(f.join(" ")).not.toMatch(/—|–|“|”/);
  });

  it("URL tidak cocok & kuota terpenuhi", () => {
    const f = newsFindings({ ...sep, delivered: 60, published: 50, inReview: 10, matched: 40, publishedListed: 42 });
    expect(f[0]).toBe("60 of the 60 planned articles were delivered (100.0%). 50 are published and 10 are still in review.");
    expect(f.at(-1)).toBe("2 published articles could not be matched to Google Analytics by URL, so their views are not counted.");
  });
});

describe("news report data", () => {
  it("kategori ke slot tetap; tak dikenal → Other", () => {
    const s = categorySlots([
      { label: "Kuliner", count: 9 },
      { label: "tentang kudus", count: 3 },
      { label: "(tanpa kategori)", count: 1 },
      { label: "Baru", count: 2 },
    ]);
    expect(s).toHaveLength(NEWS_CATEGORY_SLOTS);
    expect(s.find((x) => x.name === "Kuliner")!.count).toBe(9);
    expect(s.find((x) => x.name === "Tentang Kudus")!.count).toBe(3);
    expect(s.at(-1)).toEqual({ name: "Other", count: 3 });
  });

  it("tanggal → serial Sheets", () => {
    expect(sheetDate("2026-09-01")).toBe(46266);
    expect(sheetDate(null)).toBe(null);
  });

  it("kartu KPI News: delivered 'x / kuota', in review dari 0 bulan lalu", () => {
    const cur: NewsKpiSource = { published: 42, inReview: 11, delivered: 53, quota: { value: 60 }, achievement: 53 / 60, totalViews: 1353, viewsPerArticle: 32.2, readers: 761, avgEngagementTime: 55.6 };
    const prev: NewsKpiSource = { published: 43, inReview: 0, delivered: 43, quota: { value: 60 }, achievement: 43 / 60, totalViews: 1306, viewsPerArticle: 30.4, readers: 752, avgEngagementTime: 60.5 };
    const d = kpiData(NEWS_KPIS, cur, prev);
    expect(d.values["kpi.delivered.value"]).toBe("53 / 60");
    expect(d.values["kpi.delivered.change"]).toBe("↑ +23.3% vs last month");
    expect(d.values["kpi.achievement.change"]).toBe("↑ +16.7 percentage points vs last month");
    expect(d.values["kpi.in_review.change"]).toBe("↑ from 0 last month (down)");
    expect(d.tones["kpi.in_review.change"]).toBe("bad");
    expect(d.values["kpi.avg_engagement_time.value"]).toBe("56s");
  });
});
