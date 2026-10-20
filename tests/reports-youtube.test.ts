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
  it("recap dari judul menang atas format; Editorial Feature Video = Editorial Feature", () => {
    expect(videoType("X (Recap)", "Editorial Feature")).toBe("Recap");
    expect(videoType("Della Citra Ayu", "Editorial Feature Video")).toBe("Editorial Feature");
    expect(videoType("Coming soon", "Teaser")).toBe("Teaser");
  });
  it("kategori tak dikenal → Other", () => {
    const s = ytCategorySlots(["Event", "venue", "Kuliner", null]);
    expect(s.find((x) => x.name === "Event")!.count).toBe(1);
    expect(s.find((x) => x.name === "Venue")!.count).toBe(1);
    expect(s.find((x) => x.name === "Other")!.count).toBe(2);
  });
});

describe("youtubeFindings", () => {
  it("kalimat kuota, seri, views MoM, CTR rendah, subscriber", () => {
    const out = youtubeFindings({
      monthLabel: "September 2026",
      prevMonthLabel: "August 2026",
      quota: 4,
      published: 4,
      recaps: 1,
      series: { name: "Q3 2026", produced: 13, publishedToDate: 8, remaining: 5 },
      views: 732,
      prevViews: 2453,
      viewsPerVideo: 183,
      top: [{ title: "Caffino", views: 350 }, { title: "Sapphire Boutique Hotel", views: 190 }],
      impressions: 6203,
      ctr: 0.04435,
      lowCtr: 2,
      watchHours: 12.15,
      avgViewDurationSec: 104,
      subsGained: 5,
      subsLost: 0,
    });
    expect(out[0]).toBe("4 of the 4 planned videos were published (100.0%). This includes 1 recap video.");
    expect(out[1]).toBe("The Q3 2026 production series has 8 of 13 videos published, with 5 still to be released.");
    expect(out).toContain("Views fell 70.2% from August 2026 (2,453 to 732).");
    expect(out).toContain('The next most watched was "Sapphire Boutique Hotel" with 190 views.');
    expect(out).toContain("2 videos had a click rate below 4%, so their title or thumbnail may need work.");
    expect(out).toContain("Viewers watched 12.2 hours in total, about 1 min 44 sec per view.");
    expect(out.at(-1)).toBe("The channel gained 5 new subscribers from these videos.");
    expect(out.join(" ")).not.toMatch(/[—–]-|\s—\s/);
  });
});
