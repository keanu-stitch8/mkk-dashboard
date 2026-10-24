import type { EmptyStreak } from "@/modules/shared/lib/empty-streak";
import type { GroupStat } from "@/modules/shared/lib/group-stats";
import type { QuotaValue } from "@/modules/shared/types/quota";
import type { ArticleViewRow, NewsArticleEntry } from "../../shared/types/news";

export interface NewsSummaryInput {
  month: string;
  /** urut tanggal */
  articles: NewsArticleEntry[];
  ga4Pages: ArticleViewRow[];
  /** waktu sync GA4 Pages terakhir bulan itu */
  ga4SyncedAt: Date | null;
  reportViews: ArticleViewRow[];
  quota: QuotaValue;
  manual: Record<string, number>;
  sources: string[];
}

/** Artikel + views dari GA4 / laporan (null = belum ada data views untuk artikel ini). */
export interface NewsArticle extends NewsArticleEntry {
  matched: boolean;
  views: number | null;
  activeUsers: number | null;
  avgEngagementTime: number | null;
}

export interface NewsSummary {
  month: string;
  hasData: boolean;
  sources: string[];
  articles: NewsArticle[];
  published: number;
  inReview: number;
  draft: number;
  quota: QuotaValue;
  delivered: number;
  /** delivered ÷ kuota */
  achievement: number | null;
  publishedRate: number | null;
  viewsSource: "ga4" | "report" | null;
  totalViews: number | null;
  viewsPerArticle: number | null;
  /** jumlah active users per artikel (bisa dihitung ganda antar artikel) */
  readers: number | null;
  /** rata-rata waktu engagement per pembaca, tertimbang active users */
  avgEngagementTime: number | null;
  matchedCount: number;
  unmatched: NewsArticle[];
  /** artikel yang baru tayang dan belum muncul di GA4 (bukan URL bermasalah) */
  pendingViews: NewsArticle[];
  zeroViews: NewsArticle[];
  topArticles: NewsArticle[];
  byCategory: GroupStat[];
  byReporter: GroupStat[];
  byType: GroupStat[];
  daily: { date: string; count: number }[];
  activeDays: number;
  emptyStreak: EmptyStreak;
}
