import type { AssetCell, AssetKey, AssetState } from "@/lib/team/contributors";

/** Baris tab Task Progress kontributor lokal (satu rencana liputan). */
export interface ContributorTaskEntry {
  id: string;
  tab: string;
  no: number;
  planned: string | null;
  guideFile: string | null;
  n: number;
  title: string;
  status: string | null;
  articleBy: string | null;
  articleAt: string | null;
  landscape: AssetState;
  landscapeBy: string | null;
  landscapeAt: string | null;
  portrait: AssetState;
  portraitBy: string | null;
  portraitAt: string | null;
  video: AssetState;
  videoBy: string | null;
  videoAt: string | null;
  interview: AssetState;
  interviewBy: string | null;
  interviewAt: string | null;
  storyCode: string | null;
}

export interface ContributorItem extends ContributorTaskEntry {
  assets: Record<AssetKey, AssetCell>;
  /** foto + video portrait + video interview tersedia */
  complete: boolean;
  /** sudah ada aset yang dilaporkan (Available / Not Available) */
  reported: boolean;
  /** bahan reel: video portrait tersedia */
  reelReady: boolean;
  lastAsset: string | null;
  storyTitle: string | null;
  /** hari dari rencana liputan sampai aset terakhir masuk */
  assetLag: number | null;
}

export interface ContributorPerson {
  alias: string;
  name: string | null;
  articles: number;
  assets: number;
  lags: number[];
  /** median hari rencana → aset */
  lag: number | null;
}

export interface ContributorsData {
  items: ContributorItem[];
  people: ContributorPerson[];
  /** alias (huruf besar) → nama */
  nameOf: Record<string, string>;
}
