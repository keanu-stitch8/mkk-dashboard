import type { EmptyStreak } from "@/modules/shared/lib/empty-streak";
import type { QuotaValue } from "@/modules/shared/types/quota";
import type { SocialReconOf } from "../../shared/lib/social-match";
import type { SocialLogEntry, SocialPostEntry } from "../../shared/types/social";

export interface SocialSummaryInput {
  month: string;
  /** post platform aktif, urut waktu tayang */
  allPosts: SocialPostEntry[];
  /** urut tanggal */
  logs: SocialLogEntry[];
  quota: QuotaValue;
  manual: Record<string, number>;
  imports: { source: string; createdAt: Date }[];
  /** insight akun IG (key tanpa awalan ig_account_) */
  account: Record<string, number>;
  /** tracker Task Progress sudah di-sync untuk bulan ini */
  hasReviewImport: boolean;
  reviewItems: string[];
  /** snapshot IG pertama setelah bulan selesai: views per media s/d akhir bulan */
  monthSnapshot: { date: string; views: Map<string, number | null> } | null;
  igTypeRows: { metric: string; type: string; value: number }[];
  storyRows: { date: string; source: string }[];
  /** tanggal Story pertama dari API (semua bulan) */
  firstApiStoryDate: string | null;
}

/** Post milik akun MKK + format bisnis & kategori dari publishing log. */
export interface SocialPost extends SocialPostEntry {
  /** format dari log (Reels berbayar ≠ Video upload); tanpa log: istilah Meta, carousel/foto = "feeds" */
  metaFormat: string;
  /** views s/d akhir bulan dari snapshot (null = belum ada snapshot) */
  monthViews: number | null;
  category: string | null;
  title: string | null;
  inLog: boolean;
  er: number | null;
}

export interface CollabPost extends SocialPostEntry {
  er: number | null;
}

export interface SocialAggregate {
  label: string;
  platform: string;
  format: string;
  posts: number;
  reach: number;
  views: number;
  interactions: number;
  avgReach: number | null;
  avgViews: number | null;
  er: number | null;
}

export interface SocialQuotaProgress {
  quota: QuotaValue;
  /** delivered = published + in review */
  count: number;
  published: number;
  inReview: number;
  rate: number | null;
  publishedRate: number | null;
  available: boolean;
}

export interface SocialStoriesInfo {
  ig: number;
  log: number;
  share: number | null;
  /** Story sebelum tanggal ini belum tercatat */
  since: string | null;
  sources: string[];
}

export interface SocialByType {
  rows: { type: string; label: string; views: number | null; reach: number | null; share: number | null }[];
  totalViews: number;
  interactions: { reels: number | null; feeds: number | null; story: number | null };
}

/** Baris log + link konten (URL log, atau permalink post pasangannya) + ID media IG (thumbnail). */
export interface SocialLogLink extends SocialLogEntry {
  link: string | null;
  igMediaId: string | null;
}

export type SocialRecon = SocialReconOf<SocialPostEntry, SocialLogEntry>;

export interface SocialSummary {
  month: string;
  hasData: boolean;
  hasLog: boolean;
  sources: string[];
  platforms: string[];
  posts: SocialPost[];
  postsPublished: number;
  /** konten yang diserahkan bulan ini & belum tayang per akhir bulan (Task Progress) */
  inReview: number;
  inReviewItems: string[];
  /** false = tracker belum di-sync untuk bulan ini (in review dianggap 0) */
  hasReview: boolean;
  countSource: "log" | "meta";
  reach: number | null;
  views: number | null;
  interactions: number | null;
  /** asal views/reach/interactions: insight akun selama bulan itu (API) atau jumlah lifetime per post (CSV lama) */
  metricsSource: "account" | "posts";
  /** jumlah views lifetime post yang dipublish bulan ini (untuk rata-rata per post) */
  postViews: number | null;
  follows: number | null;
  followsSource: "manual" | "account" | "posts" | null;
  engagementRate: number | null;
  quotaProgress: SocialQuotaProgress[];
  publishedByFormat: { format: string; count: number }[];
  /** post akun MKK yang tidak tercatat di publishing log (hanya relevan jika log ada) */
  postsNotInLog: SocialPost[];
  /** cek konsistensi Publishing Log vs Instagram API (null jika log atau post belum ada) */
  recon: SocialRecon | null;
  stories: SocialStoriesInfo | null;
  /** waktu sync/import post IG bulan itu (acuan metrik lifetime per post) */
  postsAsOf: Date | null;
  monthViewsAsOf: string | null;
  byType: SocialByType | null;
  /** post kolaborasi/repost milik akun lain — tidak dihitung ke performa maupun kuota */
  collabPosts: CollabPost[];
  activeDays: number;
  emptyStreak: EmptyStreak;
  byPlatform: SocialAggregate[];
  byFormat: SocialAggregate[];
  byCategory: SocialAggregate[];
  topPosts: SocialPost[];
  daily: { date: string; posts: number; reach: number }[];
  logs: SocialLogLink[];
}
