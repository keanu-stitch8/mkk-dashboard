import { describe, expect, it } from "vitest";
import { videoType, ytCategorySlots } from "../lib/reports/channels/youtube";
import { youtubeFindings } from "../lib/reports/channels/youtube-narrative";
import { isRecap, seriesFor, seriesProgress, YOUTUBE_SERIES } from "../lib/reports/youtube-series";

// publishing log Q3 2026 (judul disingkat): Juli 5 (2 recap), Agustus 2, September 4 (1 recap)
const LOG = [
  ["2026-07", "MilkLife Soccer Challenge All Stars 2026 (Recap)"],
  ["2026-07", "Della Citra Ayu, Dari Kudus ke Paris"],
  ["2026-07", "HYDROPLUS Soccer League All Stars 2025/2026 Recap"],
  ["2026-07", "Asyifa Sholawa Farizqi"],
  ["2026-07", "Pijar Park Wanawisata Lereng Muria"],
  ["2026-08", "Klub Sepak Bola Putri Kudus | Scorpion FC"],
  ["2026-08", "PB Sahabat"],
  ["2026-09", "Caffino Srikandi Merdeka Cup 2026 (Recap)"],
  ["2026-09", "Sapphire Boutique Hotel"],
  ["2026-09", "Muhammad Daffa Nugraha"],
  ["2026-09", "MARKASS Sport Center"],
].map(([month, title]) => ({ month, title }));

describe("seri produksi YouTube", () => {
  it("recap dikenali dari judul (huruf besar/kecil bebas)", () => {
    expect(isRecap("Caffino Srikandi Merdeka Cup 2026 (Recap)")).toBe(true);
    expect(isRecap("HYDROPLUS Soccer League All Stars 2025/2026 Recap")).toBe(true);
    expect(isRecap("PB Sahabat")).toBe(false);
  });
  it("September Q3: 5 sebelumnya, 3 bulan ini, sisa 5 dari 13 (recap tidak dihitung)", () => {
    const s = seriesFor("2026-09")!;
    expect(s.name).toBe("Q3 2026");
    expect(seriesProgress(s, "2026-09", LOG)).toEqual({ before: 5, thisMonth: 3, remaining: 5 });
    expect(seriesProgress(s, "2026-07", LOG)).toEqual({ before: 0, thisMonth: 3, remaining: 10 });
  });
  it("bulan di luar seri → tidak ada seri", () => {
    expect(seriesFor("2026-10", YOUTUBE_SERIES)).toBeNull();
  });
});

describe("tipe & kategori", () => {
  it("recap dari judul menang atas format; Teaser / kategori Hero = Hero Video", () => {
    expect(videoType("X (Recap)", "Editorial Feature")).toBe("Event Recap");
    expect(videoType("Della Citra Ayu", "Editorial Feature Video")).toBe("Editorial Feature Video");
    expect(videoType("Kudus Sports Tourism Teaser", "Teaser", "Hero")).toBe("Hero Video");
  });
  it("kategori taksonomi (Venue = Arena); Hero bukan kategori; tak dikenal → peringatan, tanpa Other", () => {
    const warnings: string[] = [];
    const s = ytCategorySlots(["Event", "venue", "Kuliner", "Hero", "Baru", null], warnings);
    expect(s.find((x) => x.name === "Event")!.count).toBe(1);
    expect(s.find((x) => x.name === "Arena")!.count).toBe(1);
    expect(s.find((x) => x.name === "Culinary")!.count).toBe(1);
    expect(s.some((x) => x.name === "Other")).toBe(false);
    expect(warnings).toHaveLength(2); // "Baru" + kosong; Hero tanpa peringatan
  });
});

describe("youtubeFindings", () => {
  const sep = {
    monthLabel: "September 2026",
    prevMonthLabel: "August 2026",
    quota: 4,
    published: 4,
    inReview: 0,
    delivered: 4,
    recaps: 1,
    series: { name: "Q3 2026", produced: 13, publishedToDate: 8, remaining: 5 },
    views: 732,
    prevViews: 2453,
    top: [
      { title: "Caffino Srikandi Merdeka Cup 2026 (Recap)", views: 350 },
      { title: "Sapphire Boutique Hotel | Esthetic Staycation di Kudus", views: 190 },
    ],
    prevTop: { title: "Klub Sepak Bola Putri Kudus | Scorpion FC", views: 2237 },
    late: [{ title: "MARKASS Sport Center, Beragam Arena Olahraga di Satu Lokasi", date: "2026-09-25", days: 6 }],
    lowCtr: [
      { title: "Muhammad Daffa Nugraha | Perjalanan Bersama PB Sahabat", ctr: 0.0142 },
      { title: "MARKASS Sport Center, Beragam Arena Olahraga di Satu Lokasi", ctr: 0.034 },
    ],
    watchedShare: 0.32,
    avgViewDurationSec: 104,
    subsGained: 5,
    topSubs: { title: "Sapphire Boutique Hotel | Esthetic Staycation di Kudus", subs: 4 },
  };

  it("September: penyebab views turun, video telat publish & CTR rendah disebut namanya", () => {
    const out = youtubeFindings(sep);
    expect(out).toEqual([
      "All 4 planned videos were delivered, including 1 recap.",
      "The Q3 2026 series now has 8 of its 13 videos out, with 5 still to be released.",
      'Views fell from 2.453 to 732. August was lifted by one video, "Klub Sepak Bola Putri Kudus", with 2.237 views.',
      'The next most watched was "Sapphire Boutique Hotel" with 190 views.',
      '"MARKASS Sport Center" went live on 25 September, so it had only 6 days to collect views for this report.',
      '"Muhammad Daffa Nugraha" (1,4%) and "MARKASS Sport Center" (3,4%) were rarely clicked when shown. Their titles or thumbnails may need work.',
      "Viewers watched about 32% of each video on average (1 min 44 sec per view).",
      'The videos brought in 5 new subscribers, 4 of them from "Sapphire Boutique Hotel".',
    ]);
    expect(out.join(" ")).not.toMatch(/—|–(?!\d)/);
  });

  it("kuota terlewati / kurang", () => {
    expect(youtubeFindings({ ...sep, published: 5, delivered: 5 })[0]).toBe("5 videos were delivered against a quota of 4, including 1 recap.");
    expect(youtubeFindings({ ...sep, published: 3, delivered: 3, recaps: 0 })[0]).toBe("3 of the 4 planned videos were delivered.");
    // in review ikut dihitung ke kuota (published + in review), sama dengan News & Social
    expect(youtubeFindings({ ...sep, published: 3, inReview: 1, delivered: 4 })[0]).toBe("All 4 planned videos were delivered (3 live, 1 waiting for approval), including 1 recap.");
  });
});
