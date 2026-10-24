import type { YoutubeSummary } from "../types/youtube-summary";

export type YoutubeTrendFields = {
  ytPublished: number | null;
  ytQuota: number;
  ytDelivered: number | null;
  ytViews: number | null;
  ytWatchHours: number | null;
  ytImpressions: number | null;
};

export const youtubeTrendFields = (y: YoutubeSummary): YoutubeTrendFields => ({
  ytPublished: y.hasData ? y.published : null,
  ytQuota: y.quota.value,
  ytDelivered: y.hasData ? y.delivered : null,
  ytViews: y.hasData ? y.views : null,
  ytWatchHours: y.hasData ? y.watchHours : null,
  ytImpressions: y.hasData ? y.impressions : null,
});
