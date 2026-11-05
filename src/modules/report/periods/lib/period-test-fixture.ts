import type { PeriodMonth, PeriodPost } from "../types/period-report";
import { reportPeriod } from "./period";

export const postFixture = (overrides: Partial<PeriodPost> = {}): PeriodPost => ({
  postId: "post-1", title: "A food guide", date: "2026-10-22", capturedOn: "2026-11-04", format: "carousel", category: "Featured News", url: null,
  views: 19127, reach: 12707, likes: 285, comments: 19, shares: 324, saves: 316, follows: 277, profileVisits: 350, ...overrides,
});

export function monthFixtures(number = 1): PeriodMonth[] {
  const period = reportPeriod(number);
  return period.months.map((month, index) => ({
    month, label: month, hasAccountData: true, locked: true, views: 1000, reach: 200, interactions: 100, engagementRate: 0.1,
    followers: { month, label: month, followers: 1100 + index * 100, net: 100, basis: "estimate", asOf: null },
    profileVisits: 100, linkTaps: 2, nonFollowerViews: 750, splitViews: 1000, nonFollowerReachShare: 0.9,
    published: 80, stories: 50, feedAndReels: 30, inReview: 2, quota: 60, socialSessions: 20,
    viewsByType: { carousel: 400, reels: 300, story: 250, other: 50 },
    posts: index === 3 ? [postFixture({ date: `${month}-10`, capturedOn: period.endDate })] : [],
  }));
}
