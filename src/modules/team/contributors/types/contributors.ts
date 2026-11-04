import type { AssetCell, AssetKey, AssetState } from "@/modules/team/ingest/contributors";

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
  /** baris dari tab "<Bulan> Extra Posts" */
  extra: boolean;
}

export interface ContributorItem extends ContributorTaskEntry {
  assets: Record<AssetKey, AssetCell>;
  /** foto + video portrait + video interview tersedia */
  complete: boolean;
  /** sudah ada aset yang dilaporkan (Available / Not Available) */
  reported: boolean;
  /** bahan carousel: foto landscape atau portrait tersedia */
  carouselReady: boolean;
  /** bahan reel: video portrait tersedia */
  reelReady: boolean;
  /** artikel sudah disubmit kontributor */
  articleDone: boolean;
  /** 1 konten = 1 artikel Submitted (dibayar per konten; aset boleh tidak lengkap) */
  content: boolean;
  /** pembagian kredit konten per penulis, mis. [["JMY", 0.5], ["ITN", 0.5]] */
  credit: [string, number][];
  /** artikel dari rencana ini sudah punya turunan IG (hanya sambungan yang dihitung) */
  igCarousel: boolean;
  igReel: boolean;
  /** berita yang tayang di mainkekudus.com dari rencana ini (hanya sambungan pasti: auto / confirmed) */
  web: { title: string; url: string | null; date: string | null } | null;
  lastAsset: string | null;
  storyTitle: string | null;
  /** hari dari rencana liputan sampai aset terakhir masuk */
  assetLag: number | null;
}

/** Berita web + turunan IG per kode Story (dari Content Pipeline). */
export type StoryIg = Map<string, { carousel: boolean; reel: boolean; web: { title: string; url: string | null; date: string | null } | null }>;

export interface ContributorRef {
  alias: string;
  name: string;
  role: string | null;
  /** nama lain di kolom Reporter News Content Logs */
  newsNames?: string | null;
  active?: boolean;
}

export interface ContributorPerson {
  alias: string;
  name: string | null;
  /** kolom Role di tab Ref */
  role: string | null;
  /** peran hanya Footage (mis. YSR) → dinilai dari footage, bukan artikel */
  footageOnly: boolean;
  /** konten (artikel Submitted), dibagi rata jika ditulis bersama */
  content: number;
  /** liputan yang minimal satu asetnya atas nama orang ini */
  footage: number;
  /** aset Available atas nama orang ini */
  assets: number;
  /** berita tayang di mainkekudus.com bulan ini yang mencantumkan orang ini di kolom Reporter */
  web: number;
  active: boolean;
  lags: number[];
  /** median hari rencana → aset */
  lag: number | null;
}

export interface ContributorRecap {
  months: { month: string; delivered: number; content: Record<string, number>; footage: Record<string, number> }[];
  /** kolom konten (penulis) */
  writers: string[];
  /** kolom footage (peran Footage-only) */
  footage: string[];
}

/** Berita yang tayang bulan ini menurut News Content Logs (sama dengan report News). */
export interface ContributorNews {
  published: number;
  /** berita yang Reporter-nya mencantumkan minimal satu kontributor lokal */
  byContributors: number;
  /** nama Reporter di luar kontributor lokal → jumlah berita, mis. "Redaksi MKK", jurnalis event */
  others: Record<string, number>;
}

/** Output IG bulan itu (semua post, bukan hanya dari liputan kontributor) — angka sama dengan Social report. */
export interface ContributorIgOutput {
  feedLive: number;
  feedReview: number;
  reelLive: number;
  reelReview: number;
}

export interface ContributorsData {
  news: ContributorNews;
  items: ContributorItem[];
  people: ContributorPerson[];
  /** alias (huruf besar) → nama */
  nameOf: Record<string, string>;
}
