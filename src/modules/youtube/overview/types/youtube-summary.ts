import type { QuotaValue } from "@/modules/shared/types/quota";
import type { GroupStat } from "@/modules/shared/lib/group-stats";
import type { YoutubeDailyPoint, YoutubeLogEntry, YoutubeVideoMetrics } from "../../shared/types/youtube";

/** Video + kategori/format dari publishing log + porsi views bulan itu. */
export interface YoutubeVideo extends YoutubeVideoMetrics {
  category: string | null;
  format: string | null;
  shareOfViews: number | null;
}

/** Bahan buildYoutubeSummary — semuanya sudah kanonik (lihat services/youtube-summary-service.ts). */
export interface YoutubeSummaryInput {
  month: string;
  videos: YoutubeVideoMetrics[];
  daily: YoutubeDailyPoint[];
  logs: YoutubeLogEntry[];
  /** metrik total hasil import/connector */
  metrics: Record<string, number>;
  /** input manual; menimpa `metrics` */
  manual: Record<string, number>;
  /** sumber import bulan itu (yt_*) */
  sources: string[];
  /** judul video Review/Approved per akhir bulan (Gantt) */
  reviewItems: string[];
  quota: QuotaValue;
}

export interface YoutubeSummary {
  month: string;
  hasData: boolean;
  sources: string[];
  views: number | null;
  watchHours: number | null;
  impressions: number | null;
  ctr: number | null;
  subsGained: number | null;
  subsLost: number | null;
  subsNet: number | null;
  hasSubsLost: boolean;
  avgViewDurationSec: number | null;
  uniqueViewers: number | null;
  viewsPerVideo: number | null;
  published: number;
  /** video Review/Approved per akhir bulan (Gantt Calendar Timeline) — sudah diserahkan, belum tayang */
  inReview: number;
  inReviewItems: string[];
  hasReview: boolean;
  /** published + in review (definisi sama dengan News & Social) */
  delivered: number;
  deliveredRate: number | null;
  quota: QuotaValue;
  /** published saja ÷ kuota (catatan QuotaHero); kuota dihitung dari deliveredRate */
  achievement: number | null;
  videos: YoutubeVideo[];
  topVideos: YoutubeVideo[];
  lowCtrVideos: YoutubeVideo[];
  byCategory: GroupStat[];
  daily: YoutubeDailyPoint[];
  logs: YoutubeLogEntry[];
}
