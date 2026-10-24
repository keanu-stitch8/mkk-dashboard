export type ScoreKey = "repurpose" | "articleToIg" | "briefToPost" | "backlog" | "assets" | "quota";

export interface ScoreDef {
  key: ScoreKey;
  label: string;
  unit: "%" | "days" | "briefs";
  /** usulan awal — dibahas dengan Content & Creative Manager */
  target: number;
  better: "higher" | "lower";
  description: string;
}

export interface Score {
  key: ScoreKey;
  value: number | null;
  detail: string;
  /** pembilang / penyebut untuk ukuran rasio */
  n?: number | null;
  base?: number | null;
}

export interface Scorecard {
  scores: Score[];
  /** waktu snapshot (bulan dikunci); null = dihitung live */
  frozenAt: Date | null;
}

export interface ScorecardMonth extends Scorecard {
  month: string;
}
