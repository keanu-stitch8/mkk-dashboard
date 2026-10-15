import type { Cell } from "./values";

export type Channel = "website" | "news" | "youtube" | "social";

/** Tabel mentah hasil baca file (satu sheet XLSX atau satu blok CSV). */
export interface RawTable {
  file: string;
  sheet?: string;
  rows: Cell[][];
  comments: string[];
  /** rentang tanggal dari metadata file (komentar GA4, sheet Filters GSC, nama folder YouTube) */
  startDate?: string;
  endDate?: string;
  /** judul report (baris komentar kedua GA4) */
  title?: string;
  /** jumlah blok dalam file (GA4 overview punya banyak blok) */
  blockCount: number;
}

export type DatasetKey =
  | "ga4_traffic"
  | "ga4_pages"
  | "ga4_landing"
  | "ga4_overview"
  | "ga4_city"
  | "gsc_queries"
  | "gsc_pages"
  | "gsc_dates"
  | "gsc_devices"
  | "gsc_countries"
  | "yt_table"
  | "yt_daily"
  | "yt_log"
  | "meta_instagram"
  | "meta_facebook"
  | "news_log"
  | "news_views"
  | "social_log";

export type SourceGroup = "auto" | "ga4" | "gsc" | "youtube" | "meta" | "news" | "social_log";

export interface MetricOut {
  channel: Channel;
  key: string;
  value: number;
}

export interface BreakdownOut {
  channel: Channel;
  dimension: string;
  label: string;
  metric: string;
  value: number;
}

/** Satu baris record; `_date` (YYYY-MM-DD) dipakai untuk filter bulan lalu dibuang saat simpan. */
export type RecordRow = Record<string, string | number | null> & { _date?: string | null };

export interface Dataset {
  key: DatasetKey;
  file: string;
  sheet?: string;
  /** bulan terdeteksi dari file (null jika tidak diketahui) */
  month: string | null;
  /** rentang tanggal data menurut file (komentar GA4, sheet Filters GSC, nama file YouTube) */
  range: { start: string; end: string | null } | null;
  /** true jika baris punya tanggal sendiri → difilter per bulan saat import */
  rowDated: boolean;
  /** prioritas saat ada dua dataset dengan key sama dalam satu upload */
  priority: number;
  columns: { field: string; header: string }[];
  unmatched: string[];
  rows: RecordRow[];
  metrics: MetricOut[];
  breakdowns: BreakdownOut[];
  warnings: string[];
}

export interface SkippedTable {
  file: string;
  sheet?: string;
  reason: string;
  /** tabel dikenali tapi tidak bisa dipakai — user perlu bertindak (tampilkan menonjol) */
  actionable?: boolean;
}

/** Tabel yang dikenali tapi sengaja tidak dipakai, dengan alasan yang jelas untuk user. */
export interface SkipNotice {
  skip: string;
}

export interface ParseResult {
  datasets: Dataset[];
  skipped: SkippedTable[];
  errors: string[];
}

export interface InputFile {
  name: string;
  data: Uint8Array;
}
