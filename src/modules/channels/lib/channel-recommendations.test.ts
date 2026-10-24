import { afterEach, describe, expect, it, vi } from "vitest";
import type { Channel } from "@/lib/parsers/types";
import { prevMonth } from "@/lib/month";
import { channelRecommendations, generateRecommendations } from "@/lib/recommendations";
import { buildNewsOverview } from "@/modules/news/overview/lib/news-overview";
import { channelPageMonths } from "@/modules/shared/lib/trend-months";
import { buildSocialOverview } from "@/modules/social/overview/lib/social-overview";
import { buildWebsiteOverview } from "@/modules/website/overview/lib/website-overview";
import { buildYoutubeOverview } from "@/modules/youtube/overview/lib/youtube-overview";
import { buildNewsSummary } from "@/modules/news/overview/lib/news-summary";
import { buildSocialSummary } from "@/modules/social/overview/lib/social-summary";
import { buildWebsiteSummary } from "@/modules/website/overview/lib/website-summary";
import { input as youtubeInput, video } from "@/modules/youtube/overview/lib/youtube-fixtures.test-utils";
import { buildYoutubeSummary } from "@/modules/youtube/overview/lib/youtube-summary";
import type { MonthBundle } from "../types/month-bundle";

const quota = (key: string, value: number) => ({ key, label: key, value, override: false });

/** Bundle kecil yang memicu rule dari keempat channel (termasuk rule yang membaca `cur.month`). */
function bundle(month: string, scale: number): MonthBundle {
  return {
    month,
    website: buildWebsiteSummary({
      month,
      sources: ["ga4_traffic", "gsc_queries"],
      channels: [{ channel: "Organic Search", sessions: 100 * scale, engagedSessions: 40 * scale, engagementRate: 0.4, avgEngagementTime: 30 }],
      pages: [],
      landings: [],
      metrics: { users: 80 * scale, gsc_impressions: 3000 * scale, gsc_clicks: 10 * (2 - scale) },
      breakdowns: [],
      gscDaily: [],
      gscQueries: [{ query: "wisata kudus", clicks: 1, impressions: 500, ctr: 0.002, position: 6 }],
      gscPages: [{ url: "https://mainkekudus.com/a", path: "/a", clicks: 0, impressions: 120, ctr: 0, position: 8 }],
      manual: {},
    }),
    news: buildNewsSummary({
      month,
      articles: [1, 2, 12].map((d) => ({
        id: `${month}-${d}`,
        date: `${month}-${String(d).padStart(2, "0")}`,
        submittedDate: null,
        title: `Artikel ${d}`,
        url: null,
        path: `/artikel-${d}`,
        category: "culinary",
        reporter: "A",
        status: "publish",
        type: null,
        method: null,
        story: null,
      })),
      ga4Pages: [{ path: "/artikel-1", views: 50 * scale, activeUsers: 40, avgEngagementTime: 20 }],
      ga4SyncedAt: null,
      reportViews: [],
      quota: quota("news", 30),
      manual: {},
      sources: ["news_log"],
    }),
    youtube: buildYoutubeSummary(youtubeInput({ month, sources: ["yt_videos"], videos: [video({ videoId: "a", title: "A", views: 100 * scale, impressions: 5000, ctr: 0.01, durationSec: 600, avgViewDurationSec: 30 })] })),
    social: buildSocialSummary({
      month,
      allPosts: [],
      logs: [{ id: `${month}-l1`, date: `${month}-03`, platform: "instagram", format: "reels", category: "Culinary", admin: null, designer: null, status: "publish", title: "Soto", url: null, story: null }],
      quota: quota("social", 40),
      manual: {},
      imports: [{ source: "social_log", createdAt: new Date("2026-10-01T00:00:00Z") }],
      account: {},
      hasReviewImport: false,
      reviewItems: [],
      monthSnapshot: null,
      igTypeRows: [],
      storyRows: [],
      firstApiStoryDate: null,
    }),
  };
}

afterEach(() => vi.restoreAllMocks());

const MONTH = "2026-09";
const bundles = new Map(channelPageMonths(MONTH).map((m, i) => [m, bundle(m, 1 + i / 4)]));
const of = <C extends Channel>(ch: C) => new Map([...bundles].map(([m, b]) => [m, b[ch]] as const)) as Map<string, MonthBundle[C]>;

describe("rekomendasi halaman channel", () => {
  const cur = bundles.get(MONTH)!;
  const prev = bundles.get(prevMonth(MONTH))!;
  const builders = {
    website: () => buildWebsiteOverview(MONTH, of("website")).recommendations,
    news: () => buildNewsOverview(MONTH, of("news")).recommendations,
    youtube: () => buildYoutubeOverview(MONTH, of("youtube")).recommendations,
    social: () => buildSocialOverview(MONTH, of("social")).recommendations,
  } satisfies Record<Channel, () => unknown>;

  it.each<Channel>(["website", "news", "youtube", "social"])("%s: sama dengan bundle penuh yang difilter, tanpa rule yang gagal", (channel) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const own = builders[channel]();
    expect(error).not.toHaveBeenCalled();
    expect(own).toEqual(generateRecommendations({ cur, prev }).filter((r) => r.channel === channel));
    expect(own.length).toBeGreaterThan(0);
  });

  it("rule hari kosong (membaca cur.month) ikut jalan", () => {
    const ids = [...builders.news(), ...builders.social()].map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["news-empty-days", "social-empty-days"]));
  });

  it("konteks tanpa month → rule yang membacanya gagal (alasan builder wajib mengirim month)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    channelRecommendations("social", { cur: { social: cur.social }, prev: null } as never);
    expect(error).toHaveBeenCalled();
  });
});
