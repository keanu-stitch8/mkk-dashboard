import type { WebsiteSummary } from "../types/website-summary";

export type WebsiteTrendFields = {
  websiteUsers: number | null;
  websiteSessions: number | null;
  pageviews: number | null;
  engagementRate: number | null;
  gscClicks: number | null;
  gscImpressions: number | null;
};

export const websiteTrendFields = (w: WebsiteSummary): WebsiteTrendFields => ({
  websiteUsers: w.users,
  websiteSessions: w.sessions,
  pageviews: w.pageviews,
  engagementRate: w.engagementRate,
  gscClicks: w.gscClicks,
  gscImpressions: w.gscImpressions,
});
