/** Sesi per channel traffic GA4 (Session primary channel group). */
export interface Ga4ChannelRow {
  channel: string;
  sessions: number;
  engagedSessions: number | null;
  engagementRate: number | null;
  avgEngagementTime: number | null;
}

export interface Ga4PageRow {
  path: string;
  title: string | null;
  views: number;
  activeUsers: number | null;
  avgEngagementTime: number | null;
}

export interface Ga4LandingRow {
  path: string;
  sessions: number;
  activeUsers: number | null;
  newUsers: number | null;
  avgEngagementTime: number | null;
}

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  /** pecahan 0–1 */
  ctr: number;
  position: number;
}

export interface GscPageRow {
  url: string;
  path: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscDailyPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface BreakdownRow {
  dimension: string;
  label: string;
  metric: string;
  value: number;
}
