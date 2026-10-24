/** Metrik satu video dari YouTube Analytics (connector / export Studio). */
export interface YoutubeVideoMetrics {
  videoId: string;
  title: string;
  publishedDate: string | null;
  durationSec: number | null;
  views: number;
  watchHours: number | null;
  avgViewDurationSec: number | null;
  impressions: number | null;
  /** pecahan 0–1 */
  ctr: number | null;
  uniqueViewers: number | null;
  subsGained: number | null;
  subsLost: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

/** Satu baris Youtube Calendar Timeline (Summary) + editor dari tab Tracker. */
export interface YoutubeLogEntry {
  date: string | null;
  title: string;
  url: string | null;
  videoId: string | null;
  format: string | null;
  category: string | null;
  editor: string | null;
  /** publish | review | draft | lainnya */
  status: string;
}

export interface YoutubeDailyPoint {
  date: string;
  watchHours: number | null;
  views: number | null;
}
