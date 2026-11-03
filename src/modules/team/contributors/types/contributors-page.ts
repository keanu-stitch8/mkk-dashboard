import type { ContributorsData } from "./contributors";

export interface ContributorsPage extends ContributorsData {
  month: string;
  months: string[];
  /** target konten per bulan (1 konten = artikel + foto + video) */
  target: number;
  content: number;
  articles: number;
  reported: number;
  carousel: number;
  reel: number;
  /** rencana yang artikelnya sudah punya turunan IG */
  toIg: number;
  igCarousel: number;
  igReel: number;
}
