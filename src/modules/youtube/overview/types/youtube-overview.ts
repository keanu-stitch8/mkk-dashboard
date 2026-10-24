import type { Recommendation } from "@/lib/recommendations";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import type { YoutubeSummary } from "./youtube-summary";

/** Satu titik grafik tren (ChartCard butuh `label`). null = bulan tanpa data YouTube. `type`, bukan interface: ChartCard menerima Record. */
export type YoutubeTrendPoint = {
  month: string;
  label: string;
  published: number | null;
  delivered: number | null;
  quota: number;
  views: number | null;
};

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
