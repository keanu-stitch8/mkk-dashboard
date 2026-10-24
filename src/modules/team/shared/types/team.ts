/** Rencana artikel dari panduan liputan harian ("Artikel N"). Kode = YYMMDD-N. */
export interface StoryEntry {
  code: string;
  /** tanggal panduan */
  date: string;
  month: string;
  n: number;
  title: string;
  angle: string | null;
  fileId: string;
  fileName: string;
}

/** Brief carousel / reel (file .docx di Drive). */
export interface BriefEntry {
  fileId: string;
  fileName: string;
  /** dari nama file */
  date: string;
  month: string;
  /** carousel | reel | lainnya */
  type: string;
  topic: string;
  headline: string | null;
  /** satu baris per slide/scene */
  outline: string | null;
  webViewLink: string | null;
  modifiedTime: string | null;
}

/** Baris "Social Media - Task Progress" untuk satu brief. */
export interface BriefTaskEntry {
  briefKey: string;
  briefName: string;
  tab: string;
  planned: string | null;
  article: string | null;
  format: string;
  /** huruf kecil: published, reviewing, submitted, unpublished, … */
  status: string | null;
  assignee: string | null;
  submitted: string | null;
  published: string | null;
  igUrl: string | null;
  note: string | null;
}

export interface TeamMatchEntry {
  id: string;
  fromType: string;
  fromKey: string;
  toType: string;
  toKey: string;
  toTitle: string;
  toDate: string | null;
  toFormat: string | null;
  toUrl: string | null;
  score: number;
  status: string;
  decidedBy: string | null;
  decidedAt: Date | null;
}

export type MatchState = "confirmed" | "coded" | "tracker" | "auto" | "suggested";

export interface LinkView {
  id: string;
  /** kunci target (articleKey / socialKey) */
  key: string;
  state: MatchState;
  title: string;
  date: string | null;
  format: string | null;
  url: string | null;
  /** siapa & kapan (keputusan tim) */
  decidedBy: string | null;
  decidedAt: Date | null;
}

/** Pasangan terpakai: confirmed/auto (satu), atau daftar saran jika belum ada. */
export interface Linked {
  match: LinkView | null;
  suggestions: LinkView[];
}

/** Kelompok status Task Progress (lihat tab Ref). */
export type TaskStage = "published" | "review" | "production" | "stopped";

/** Status gabungan satu brief — urutan: posted > needs confirmation > in review > belum. */
export type BriefState = "posted" | "check" | "review" | "waiting";

export interface StoryRow extends StoryEntry {
  article: Linked;
  /** hari dari panduan sampai artikel tayang */
  lag: number | null;
}

export interface BriefTaskView extends BriefTaskEntry {
  stage: TaskStage | null;
  /** link IG yang sama dipakai beberapa brief di tracker (salah tempel) */
  linkShared: boolean;
}

export interface BriefRow extends BriefEntry {
  outlineLines: string[];
  social: Linked;
  article: Linked;
  task: BriefTaskView | null;
  state: BriefState;
  postedOn: string | null;
  /** hari dari brief sampai tayang */
  lag: number | null;
}

/** Bulan halaman tim + daftar pilihan bulan (terbaru dulu). */
export interface TeamMonthContext {
  month: string;
  months: string[];
}
