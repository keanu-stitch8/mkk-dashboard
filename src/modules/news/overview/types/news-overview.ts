import type { Recommendation } from "@/lib/recommendations";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import type { NewsTrendFields } from "../lib/news-trend";
import type { NewsSummary } from "./news-summary";

export type NewsTrendPoint = { month: string; label: string } & NewsTrendFields;

export interface NewsOverview {
  month: string;
  summary: NewsSummary;
  /** bulan lalu; null jika bulan lalu tidak punya data News */
  prev: NewsSummary | null;
  quota: QuotaSummary;
  prevQuota: QuotaSummary | null;
  trend: NewsTrendPoint[];
  recommendations: Recommendation[];
}
