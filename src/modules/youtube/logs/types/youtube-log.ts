/** Satu baris tabel Publishing Log YouTube (bentuk sama dengan LogRow di PublishingLogTable). */
export interface YoutubeLogRow {
  date: string | null;
  title: string;
  url: string | null;
  /** publish | review | draft | lainnya */
  status: string;
  fields: { format: string | null; category: string | null; editor: string | null };
  thumb?: string | null;
}

export interface YoutubeLogs {
  rows: YoutubeLogRow[];
  published: number;
  inReview: number;
}
