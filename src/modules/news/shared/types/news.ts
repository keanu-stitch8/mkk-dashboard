/** Satu baris News Content Logs. `id` = identitas baris (pencocokan Team, key tabel). */
export interface NewsArticleEntry {
  id: string;
  date: string | null;
  submittedDate: string | null;
  title: string;
  url: string | null;
  path: string | null;
  category: string | null;
  reporter: string | null;
  /** publish | review | draft | lainnya */
  status: string;
  type: string | null;
  method: string | null;
  /** kode liputan (kolom Story, opsional) */
  story: string | null;
}

/** Views per path artikel: dari GA4 Pages, atau dari laporan News (NewsView) jika GA4 tidak ada. */
export interface ArticleViewRow {
  path: string;
  views: number;
  activeUsers: number | null;
  avgEngagementTime: number | null;
}
