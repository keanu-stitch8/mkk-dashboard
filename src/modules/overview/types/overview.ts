import type { Recommendation } from "@/modules/recommendations/lib/recommendations";
import type { MonthBundle } from "@/modules/channels/types/month-bundle";
import type { TrendPoint } from "@/modules/channels/types/trend";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import type { SocialComparable } from "@/modules/social/overview/lib/social-compare";
import type { OverviewComparison, OverviewKpis } from "../lib/overview-kpis";
import type { Audience } from "./audience";

export interface ChannelStatus {
  key: "website" | "news" | "social" | "youtube";
  label: string;
  has: boolean;
  href: string;
}

export interface QuotaPair {
  cur: QuotaSummary;
  /** null jika bulan lalu channel ini tanpa data */
  prev: QuotaSummary | null;
}

export interface Overview {
  month: string;
  cur: MonthBundle;
  prev: MonthBundle;
  channels: ChannelStatus[];
  quotas: { news: QuotaPair; social: QuotaPair; youtube: QuotaPair };
  kpi: OverviewKpis;
  cmp: OverviewComparison;
  /** ada KPI gabungan yang hanya dibandingkan sebagian komponennya */
  anyPartial: boolean;
  socialComparable: SocialComparable | null;
  /** rentang tren berisi bulan Instagram dan bulan Facebook → grafik views per platform */
  socialMixed: boolean;
  audience: Audience;
  prevAudience: Audience;
  trend: (TrendPoint & { label: string })[];
  recommendations: Recommendation[];
}
