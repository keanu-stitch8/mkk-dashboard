import type { YtDaily, YtLog, YtVideo } from "@prisma/client";
import type { YoutubeDailyPoint, YoutubeLogEntry, YoutubeVideoMetrics } from "../types/youtube";

export const toYoutubeVideoMetrics = (v: YtVideo): YoutubeVideoMetrics => ({
  videoId: v.videoId,
  title: v.title,
  publishedDate: v.publishedDate,
  durationSec: v.durationSec,
  views: v.views,
  watchHours: v.watchHours,
  avgViewDurationSec: v.avgViewDurationSec,
  impressions: v.impressions,
  ctr: v.ctr,
  uniqueViewers: v.uniqueViewers,
  subsGained: v.subsGained,
  subsLost: v.subsLost,
  likes: v.likes,
  comments: v.comments,
  shares: v.shares,
});

export const toYoutubeLogEntry = (l: YtLog): YoutubeLogEntry => ({
  date: l.date,
  title: l.title,
  url: l.url,
  videoId: l.videoId,
  format: l.format,
  category: l.category,
  editor: l.editor,
  status: l.status,
});

export const toYoutubeDailyPoint = (d: YtDaily): YoutubeDailyPoint => ({ date: d.date, watchHours: d.watchHours, views: d.views });
