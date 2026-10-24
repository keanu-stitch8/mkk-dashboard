import type { SocialKpiSource } from "@/modules/report/pipeline/kpi";
import type { Recommendation } from "@/modules/recommendations/lib/recommendations";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import type { SocialComparable } from "../lib/social-compare";
import type { SocialTrendFields } from "../lib/social-trend";
import type { SocialSummary } from "./social-summary";

export type SocialTrendPoint = { month: string; label: string } & SocialTrendFields;

export interface SocialOverview {
  month: string;
  summary: SocialSummary;
  /** bulan lalu apa adanya (bisa tanpa data) — dipakai untuk catatan beda platform / beda sumber */
  prevSummary: SocialSummary;
  /** kartu KPI: bulan lalu hanya metrik yang sebanding */
  kpi: { cur: SocialKpiSource; prev: SocialKpiSource | null; cmp: SocialComparable | null };
  quota: QuotaSummary;
  prevQuota: QuotaSummary | null;
  trend: SocialTrendPoint[];
  /** rentang tren berisi bulan Instagram dan bulan Facebook → grafik views per platform */
  mixedPlatforms: boolean;
  recommendations: Recommendation[];
}
