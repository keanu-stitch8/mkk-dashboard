import type { BreakdownRow, Ga4ChannelRow, Ga4LandingRow, Ga4PageRow, GscDailyPoint, GscPageRow, GscQueryRow } from "../../shared/types/website";

export interface WebsiteSummaryInput {
  month: string;
  sources: string[];
  channels: Ga4ChannelRow[];
  /** urut views terbanyak */
  pages: Ga4PageRow[];
  /** 10 landing page teratas (urut sessions) */
  landings: Ga4LandingRow[];
  metrics: Record<string, number>;
  breakdowns: BreakdownRow[];
  gscDaily: GscDailyPoint[];
  /** urut impressions terbanyak */
  gscQueries: GscQueryRow[];
  /** urut klik terbanyak */
  gscPages: GscPageRow[];
  manual: Record<string, number>;
}

export interface SourceShare {
  label: string;
  sessions: number;
  share: number | null;
  engagementRate: number | null;
  avgEngagementTime: number | null;
}

export interface LabelValue {
  label: string;
  value: number;
}

export interface WebsiteSummary {
  month: string;
  hasData: boolean;
  hasGa4: boolean;
  hasGsc: boolean;
  sources: string[];
  users: number | null;
  /** users dari estimasi (users_est), bukan angka resmi */
  usersEstimated: boolean;
  newUsers: number | null;
  sessions: number | null;
  engagedSessions: number | null;
  engagementRate: number | null;
  bounceRate: number | null;
  avgEngagementTime: number | null;
  pageviews: number | null;
  hasPages: boolean;
  gscClicks: number | null;
  gscImpressions: number | null;
  gscCtr: number | null;
  gscPosition: number | null;
  sourceBreakdown: SourceShare[];
  topPages: Ga4PageRow[];
  topLanding: Ga4LandingRow[];
  gscDaily: GscDailyPoint[];
  topQueries: GscQueryRow[];
  /** posisi 4–10, impressions terbanyak */
  opportunityQueries: GscQueryRow[];
  /** impressions ≥30 & CTR <2% */
  lowCtrPages: GscPageRow[];
  gscTopPages: GscPageRow[];
  cities: LabelValue[];
  devices: LabelValue[];
  firstChannels: LabelValue[];
}
