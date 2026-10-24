import { afterEach, describe, expect, it, vi } from "vitest";
import { input, video } from "./youtube-fixtures.test-utils";
import { channelPageMonths } from "@/modules/shared/lib/trend-months";
import { buildYoutubeOverview } from "./youtube-overview";
import { buildYoutubeSummary } from "./youtube-summary";

const summaries = (data: Record<string, Parameters<typeof input>[0]>) =>
  new Map(channelPageMonths("2026-09").map((m) => [m, buildYoutubeSummary(input({ month: m, ...data[m] }))]));

afterEach(() => vi.restoreAllMocks());

describe("buildYoutubeOverview", () => {
  it("bulan tren dipotong di bulan launching + bulan lalu ikut dimuat sekali", () => {
    expect(channelPageMonths("2026-09")).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(channelPageMonths("2026-06")).toEqual(["2026-06", "2026-05"]);
  });

  it("tren null untuk bulan tanpa data; prev null jika bulan lalu kosong", () => {
    const o = buildYoutubeOverview("2026-09", summaries({ "2026-09": { sources: ["yt_videos"], videos: [video({ videoId: "a", title: "A", views: 10 })] } }));
    expect(o.prev).toBeNull();
    expect(o.prevQuota).toBeNull();
    expect(o.trend.map((t) => [t.label, t.ytViews])).toEqual([["Jun 26", null], ["Jul 26", null], ["Aug 26", null], ["Sep 26", 10]]);
  });

  it("rekomendasi YouTube jalan dengan data YouTube saja (rule tidak membaca channel lain)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const low = video({ videoId: "a", title: "A", views: 100, impressions: 5000, ctr: 0.01, durationSec: 600, avgViewDurationSec: 30 });
    const o = buildYoutubeOverview(
      "2026-09",
      summaries({
        "2026-08": { sources: ["yt_videos"], videos: [video({ videoId: "x", title: "X", views: 1000 })] },
        "2026-09": { sources: ["yt_videos"], videos: [low] },
      }),
    );
    expect(error).not.toHaveBeenCalled();
    expect(o.recommendations.map((r) => r.id).sort()).toEqual(["yt-low-ctr-0", "yt-low-ctr-1", "yt-quota", "yt-retention", "yt-views-change"]);
    expect(o.recommendations.every((r) => r.channel === "youtube")).toBe(true);
  });
});
