export interface RecapMonth {
  month: string;
  stories: number;
  articles: number;
  briefs: number;
  feeds: number;
  reels: number;
  igStories: number;
  youtube: number | null;
  /** pageviews website + views social + views YouTube */
  views: number | null;
  repurpose: number | null;
  repurposeN: number | null;
  repurposeBase: number | null;
}

export interface Recap {
  year: string;
  first: string;
  last: string;
  months: RecapMonth[];
  totals: {
    guides: number;
    stories: number;
    contributorStories: number;
    assetsDelivered: number;
    articles: number;
    briefs: number;
    carouselBriefs: number;
    reelBriefs: number;
    feeds: number;
    reels: number;
    igStories: number;
    youtube: number | null;
    views: number | null;
    repurposed: number;
    repurposeBase: number;
    /** bulan pertama yang punya data tim (panduan, brief) */
    teamSince: string | null;
  };
  followers: { start: number | null; end: number | null; startEstimated: boolean };
  subscribers: { start: number | null; end: number | null };
  websiteReaders: number | null;
}
