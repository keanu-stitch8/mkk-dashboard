import type { ContributorIgOutput, ContributorRecap, ContributorsData } from "./contributors";

export interface ContributorsPage extends ContributorsData {
  month: string;
  months: string[];
  /** target konten per bulan (1 konten = 1 artikel Submitted) */
  target: number;
  content: number;
  /** konten dari tab Extra Posts (sudah termasuk di content) */
  extra: number;
  /** konten yang asetnya lengkap (foto + video portrait + wawancara) — info, bukan syarat */
  complete: number;
  articles: number;
  reported: number;
  carousel: number;
  reel: number;
  /** carousel & reel IG bulan itu, sama dengan Social report */
  ig: ContributorIgOutput;
  recap: ContributorRecap;
}
