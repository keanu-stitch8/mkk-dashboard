import type { NewsSummary } from "@/modules/news/overview/types/news-summary";
import type { SocialSummary } from "@/modules/social/overview/types/social-summary";
import type { WebsiteSummary } from "@/modules/website/overview/types/website-summary";
import type { YoutubeSummary } from "@/modules/youtube/overview/types/youtube-summary";

/** Ringkasan keempat channel untuk satu bulan (Overview, Report, Scorecard, rekomendasi lintas channel). */
export interface MonthBundle {
  month: string;
  website: WebsiteSummary;
  news: NewsSummary;
  youtube: YoutubeSummary;
  social: SocialSummary;
}
