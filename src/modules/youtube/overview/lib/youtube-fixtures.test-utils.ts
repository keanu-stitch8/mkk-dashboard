import type { YoutubeVideoMetrics } from "../../shared/types/youtube";
import type { YoutubeSummaryInput } from "../types/youtube-summary";

export const video = (o: Partial<YoutubeVideoMetrics> & Pick<YoutubeVideoMetrics, "videoId" | "title" | "views">): YoutubeVideoMetrics => ({
  publishedDate: null,
  durationSec: null,
  watchHours: null,
  avgViewDurationSec: null,
  impressions: null,
  ctr: null,
  uniqueViewers: null,
  subsGained: null,
  subsLost: null,
  likes: null,
  comments: null,
  shares: null,
  ...o,
});

export const input = (o: Partial<YoutubeSummaryInput> = {}): YoutubeSummaryInput => ({
  month: "2026-09",
  videos: [],
  daily: [],
  logs: [],
  metrics: {},
  manual: {},
  sources: [],
  reviewItems: [],
  quota: { key: "youtube", label: "YouTube", value: 4, override: false },
  ...o,
});
