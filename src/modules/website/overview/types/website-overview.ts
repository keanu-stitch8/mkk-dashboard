import type { Recommendation } from "@/modules/recommendations/lib/recommendations";
import type { WebsiteTrendFields } from "../lib/website-trend";
import type { WebsiteSummary } from "./website-summary";

export type WebsiteTrendPoint = { month: string; label: string } & WebsiteTrendFields;

export interface WebsiteOverview {
  month: string;
  summary: WebsiteSummary;
  /** bulan lalu; null jika bulan lalu tidak punya data Website */
  prev: WebsiteSummary | null;
  trend: WebsiteTrendPoint[];
  recommendations: Recommendation[];
}
