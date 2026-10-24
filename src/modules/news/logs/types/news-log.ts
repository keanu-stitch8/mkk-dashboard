/** Satu baris tabel Publishing Log News (bentuk sama dengan LogRow di PublishingLogTable). */
export interface NewsLogRow {
  date: string | null;
  title: string;
  url: string | null;
  status: string;
  fields: { reporter: string | null; category: string | null; type: string | null };
  thumb: string | null;
}

export interface NewsLogs {
  rows: NewsLogRow[];
  published: number;
  inReview: number;
}
