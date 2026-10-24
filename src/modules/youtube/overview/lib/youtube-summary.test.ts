import { describe, expect, it } from "vitest";
import { input, video } from "./youtube-fixtures.test-utils";
import { youtubeQuota } from "./youtube-quota";
import { buildYoutubeSummary } from "./youtube-summary";

const log = (title: string, status: string, o: { videoId?: string; category?: string } = {}) => ({
  date: "2026-09-10", title, url: null, videoId: o.videoId ?? null, format: null, category: o.category ?? null, editor: null, status,
});

describe("buildYoutubeSummary", () => {
  it("tanpa import & input manual → hasData false", () => {
    const y = buildYoutubeSummary(input());
    expect(y.hasData).toBe(false);
    expect(y.views).toBeNull();
    expect(youtubeQuota(y).rate).toBeNull();
  });

  it("urutan sumber angka: manual → total import → jumlah per video", () => {
    const videos = [video({ videoId: "a", title: "A", views: 100, impressions: 1000, ctr: 0.05 }), video({ videoId: "b", title: "B", views: 50, impressions: 1000, ctr: 0.03 })];
    expect(buildYoutubeSummary(input({ videos, sources: ["yt_videos"] })).views).toBe(150);
    expect(buildYoutubeSummary(input({ videos, sources: ["yt_videos"], metrics: { views: 900 } })).views).toBe(900);
    expect(buildYoutubeSummary(input({ videos, sources: ["yt_videos"], metrics: { views: 900 }, manual: { views: 1000 } })).views).toBe(1000);
    // CTR channel = rata-rata tertimbang impressions
    expect(buildYoutubeSummary(input({ videos, sources: ["yt_videos"] })).ctr).toBeCloseTo(0.04);
  });

  it("kategori dari log (videoId dulu, lalu judul) + published dari log", () => {
    const videos = [video({ videoId: "a", title: "Video A", views: 100 }), video({ videoId: "b", title: "Video B ", views: 40 })];
    const logs = [log("Judul lain", "publish", { videoId: "a", category: "sport" }), log("video b", "publish", { category: "culture" }), log("Draft", "draft")];
    const y = buildYoutubeSummary(input({ videos, logs, sources: ["yt_videos", "yt_log"] }));
    expect(y.videos.map((v) => v.category)).toEqual(["sport", "culture"]);
    expect(y.published).toBe(2);
    expect(y.videos[0].shareOfViews).toBeCloseTo(100 / 140);
  });

  it("delivered = published + in review dari Gantt; tanpa sync Gantt hasReview false", () => {
    const logs = [log("A", "publish"), log("B", "publish")];
    const synced = buildYoutubeSummary(input({ logs, sources: ["yt_log", "yt_review"], reviewItems: ["C"] }));
    expect([synced.published, synced.inReview, synced.delivered, synced.deliveredRate]).toEqual([2, 1, 3, 0.75]);
    expect(youtubeQuota(synced).note).toMatch(/^Published only: 2 \/ 4/);
    const notSynced = buildYoutubeSummary(input({ logs, sources: ["yt_log"] }));
    expect(notSynced.hasReview).toBe(false);
    expect(youtubeQuota(notSynced).note).toMatch(/hasn't been synced/);
  });
});
