import type { Recommendation } from "@/lib/recommendations";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import type { YoutubeTrendFields } from "../lib/youtube-trend";
import type { YoutubeSummary } from "./youtube-summary";

export type YoutubeTrendPoint = { month: string; label: string } & YoutubeTrendFields;

export interface YoutubeOverview {
  month: string;
  summary: YoutubeSummary;
  /** bulan lalu; null jika bulan lalu tidak punya data YouTube */
  prev: YoutubeSummary | null;
  quota: QuotaSummary;
  prevQuota: QuotaSummary | null;
  trend: YoutubeTrendPoint[];
  recommendations: Recommendation[];
}
