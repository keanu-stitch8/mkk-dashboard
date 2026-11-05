import type { FollowerPoint } from "@/modules/social/overview/types/social-audience";
import type { CsvPostFollows } from "@/modules/social/shared/types/csv-follows";

export interface ReportPeriod {
  number: number;
  months: string[];
  startMonth: string;
  endMonth: string;
  startDate: string;
  endDate: string;
  days: number;
  rangeLabel: string;
  shortRangeLabel: string;
  label: string;
}

export interface PeriodPostMetrics {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
}

export interface PeriodPost extends PeriodPostMetrics {
  postId: string;
  title: string;
  date: string;
  format: string;
  category: string | null;
  url: string | null;
  capturedOn: string | null;
  profileVisits: number | null;
  followsCsv?: CsvPostFollows | null;
}

export interface PeriodMediaSnapshot extends PeriodPostMetrics {
  mediaId: string;
  date: string;
}

export interface PeriodMonth {
  month: string;
  label: string;
  hasAccountData: boolean;
  locked: boolean;
  views: number | null;
  reach: number | null;
  interactions: number | null;
  engagementRate: number | null;
  followers: FollowerPoint;
  profileVisits: number | null;
  linkTaps: number | null;
  nonFollowerViews: number | null;
  splitViews: number | null;
  nonFollowerReachShare: number | null;
  published: number;
  stories: number;
  feedAndReels: number;
  inReview: number;
  quota: number | null;
  socialSessions: number | null;
  viewsByType: { carousel: number | null; reels: number | null; story: number | null; other: number | null };
  posts: PeriodPost[];
}

export interface PeriodCategory {
  label: string;
  posts: number;
  recordedPosts: number;
  views: number | null;
  avgViews: number | null;
}

export interface PeriodReportData {
  period: ReportPeriod;
  postSnapshotDate: string;
  months: PeriodMonth[];
  openingFollowers: number | null;
  closingFollowers: number | null;
  followersEstimated: boolean;
  netFollows: number | null;
  followsPerDay: number | null;
  views: number | null;
  interactions: number | null;
  profileVisits: number | null;
  linkTaps: number | null;
  linkTapRate: number | null;
  socialSessions: number | null;
  nonFollowerViewShare: number | null;
  published: number;
  stories: number;
  feedAndReels: number;
  quota: number | null;
  posts: PeriodPost[];
  topPosts: PeriodPost[];
  caseCandidates: PeriodPost[];
  categories: PeriodCategory[];
  caseStudy: PeriodPost | null;
  warnings: string[];
  blockedReasons: string[];
}

export interface PeriodReportOptions {
  casePostId?: string;
  organic?: boolean;
  followerTarget?: number;
  targetDate?: string;
}

export interface PeriodReportJob {
  url: string | null;
  pdfUrl: string | null;
  status: string;
  createdAt: string;
  error: string | null;
  warnings: string | null;
}

export interface PeriodReportPage {
  data: PeriodReportData;
  periods: { number: number; label: string; complete: boolean }[];
  jobs: PeriodReportJob[];
  googleConnected: boolean;
  templateUrl: string;
}
