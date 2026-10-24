import type { StoryRow } from "../../shared/types/team";

export type DerivKind = "feed" | "reel" | "story";

export interface Derivative {
  kind: DerivKind;
  date: string;
  title: string;
  /** asal sambungan: lewat brief, IG story yang judulnya cocok dengan artikel, atau kolom Story di log */
  via: "brief" | "match" | "code";
  /** IG story yang tayang sebelum artikel */
  teaser: boolean;
}

export interface BriefLite {
  fileId: string;
  type: string;
  title: string;
  date: string;
  webViewLink: string | null;
  postedOn: string | null;
}

/** Brief & turunan IG satu artikel. */
export interface ArticleDerivatives {
  briefs: BriefLite[];
  derivs: Derivative[];
}

export type PipelineStage = "done" | "brief" | "article" | "check" | "missing";

export interface PipelineRow extends StoryRow {
  briefs: BriefLite[];
  derivs: Derivative[];
  stage: PipelineStage;
  /** hari tertahan sejak tahap terakhir yang selesai (null = sudah ada turunan) */
  stuck: number | null;
  /** artikel → turunan IG pertama (teaser tidak dihitung) */
  repurposeLag: number | null;
}
