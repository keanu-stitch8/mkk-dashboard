import { describe, expect, it } from "vitest";
import { categorySlots, NEWS_CATEGORY_SLOTS, sheetDate } from "../src/modules/report/pipeline/channels/news";
import { newsFindings, type NewsNarrativeInput } from "../src/modules/report/pipeline/channels/news-narrative";
import { kpiData, NEWS_KPIS, type NewsKpiSource } from "../src/modules/report/pipeline/kpi";

// angka September 2026 (dashboard News)
const sep: NewsNarrativeInput = {
  monthLabel: "September 2026",
  prevMonthLabel: "August 2026",
  quota: 60,
  published: 42,
  inReview: 11,
  delivered: 53,
  prevDelivered: 43,
  prevPublished: 43,
  prevTop: { title: "Klub Futsal Kudus", views: 180 },
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
  matched: 42,
  publishedListed: 42,
};

describe("news narrative", () => {
  it("temuan September: kalimat pendek tanpa tanda pisah", () => {
    const f = newsFindings(sep);
    expect(f).toEqual([
      // delivered naik, tapi published turun 1 karena 11 masih in review → dijelaskan, bukan hanya "achievement naik"
      "53 of the 60 planned articles were delivered, up from 43 in August.",
      "11 are still waiting for approval, so 42 are live, one fewer than August.",
      "Views rose 3,6% from August (1.306 to 1.353).",
      'The next most read were "Wushu Indonesia Kudus" (102 views) and "Berlian Sports Centre" (73).',
      "Features made up almost half of the output (20 articles), while Editorial drew the most views per article (35,5).",
      "Komunitas was the most read category with 372 views from 7 articles.",
    ]);
    expect(f.join(" ")).not.toMatch(/—|–|“|”/);
  });

  it("tanpa data bulan lalu: sebut kekurangan kuota", () => {
    const f = newsFindings({ ...sep, prevDelivered: null, prevPublished: null, prevViews: null });
    expect(f[0]).toBe("53 of the 60 planned articles were delivered, 7 short of the quota.");
    expect(f[1]).toBe("11 are still waiting for approval, so 42 are live.");
  });

  it("views turun tajam karena bulan lalu didominasi satu artikel → penyebab disebut", () => {
    const f = newsFindings({ ...sep, totalViews: 500, prevTop: { title: "Klub Futsal Kudus | Liga Desa", views: 700 } });
    expect(f).toContain('Views fell from 1.306 to 500. August was lifted by one article, "Klub Futsal Kudus", with 700 views.');
  });

  it("URL tidak cocok & kuota terpenuhi", () => {
    const f = newsFindings({ ...sep, delivered: 60, published: 50, inReview: 10, matched: 40, publishedListed: 42 });
    expect(f[0]).toBe("60 of the 60 planned articles were delivered, up from 43 in August.");
    expect(f[1]).toBe("10 are still waiting for approval, so 50 are live, 7 more than August.");
    expect(f.at(-1)).toBe("2 published articles could not be matched to Google Analytics by URL, so their views are not counted.");
  });
});

describe("news report data", () => {
  it("kategori ke slot tetap (taksonomi EN, Atlet/Pelatih = Profile); tak dikenal → peringatan, tanpa Other", () => {
    const warnings: string[] = [];
    const s = categorySlots(
      [
        { label: "Kuliner", count: 9 },
        { label: "tentang kudus", count: 3 },
        { label: "Profil", count: 2 },
        { label: "Atlet", count: 4 },
        { label: "Pelatih", count: 1 },
        { label: "Baru", count: 2 },
      ],
      undefined,
      warnings,
    );
    expect(s).toHaveLength(NEWS_CATEGORY_SLOTS);
    expect(s.find((x) => x.name === "Culinary")!.count).toBe(9);
    expect(s.find((x) => x.name === "About Kudus")!.count).toBe(3);
    expect(s.find((x) => x.name === "Profile")!.count).toBe(7);
    expect(s.some((x) => x.name === "Other")).toBe(false);
    expect(warnings).toEqual([expect.stringContaining('Category "Baru" has no row')]);
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
    expect(d.values["kpi.delivered.change"]).toBe("↑ +23,3% vs last month");
    expect(d.values["kpi.achievement.change"]).toBe("↑ +16,7 percentage points vs last month");
    // in review netral: perubahan tetap ditulis, abu-abu, tanpa (up)/(down)
    expect(d.values["kpi.in_review.change"]).toBe("↑ from 0 last month");
    expect(d.tones["kpi.in_review.change"]).toBe("flat");
    expect(d.values["kpi.avg_engagement_time.value"]).toBe("56s");
  });
});
