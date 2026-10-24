import type { ContributorsData } from "./contributors";

export interface ContributorsPage extends ContributorsData {
  month: string;
  months: string[];
  complete: number;
  reported: number;
  reel: number;
  /** median hari rencana → aset terakhir */
  lag: number | null;
}
