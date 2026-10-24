/** Satu baris tabel Publishing Log Social (bentuk sama dengan LogRow di PublishingLogTable). */
export interface SocialLogRow {
  date: string | null;
  title: string;
  url: string | null;
  status: string;
  fields: { format: string | null; category: string | null; platform: string | null; designer: string | null };
  thumb?: string | null;
  /** kotak 4:5 (rasio feed Instagram) */
  thumbRatio: "4:5";
}

export interface SocialLogs {
  rows: SocialLogRow[];
  published: number;
  inReview: number;
  withLink: number;
}
