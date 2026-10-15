// Katalog sumber data (aman dipakai di client maupun server).
import type { Channel, DatasetKey, SourceGroup } from "./parsers/types";

export const DATASETS: Record<DatasetKey, { label: string; group: Exclude<SourceGroup, "auto">; channel: Channel }> = {
  ga4_traffic: { label: "GA4 · Traffic acquisition (channel)", group: "ga4", channel: "website" },
  ga4_pages: { label: "GA4 · Pages and screens", group: "ga4", channel: "website" },
  ga4_landing: { label: "GA4 · Landing page", group: "ga4", channel: "website" },
  ga4_overview: { label: "GA4 · Overview (total users / new users)", group: "ga4", channel: "website" },
  ga4_city: { label: "GA4 · Demographic details: City", group: "ga4", channel: "website" },
  gsc_queries: { label: "GSC · Queries", group: "gsc", channel: "website" },
  gsc_pages: { label: "GSC · Pages", group: "gsc", channel: "website" },
  gsc_dates: { label: "GSC · Chart / Dates", group: "gsc", channel: "website" },
  gsc_devices: { label: "GSC · Devices", group: "gsc", channel: "website" },
  gsc_countries: { label: "GSC · Countries", group: "gsc", channel: "website" },
  yt_table: { label: "YouTube · Table data (per video)", group: "youtube", channel: "youtube" },
  yt_daily: { label: "YouTube · Totals / Chart data (harian)", group: "youtube", channel: "youtube" },
  yt_log: { label: "YouTube · Publishing log", group: "youtube", channel: "youtube" },
  meta_instagram: { label: "Meta · Instagram (per post)", group: "meta", channel: "social" },
  meta_facebook: { label: "Meta · Facebook (per post)", group: "meta", channel: "social" },
  news_log: { label: "News · Content log (artikel)", group: "news", channel: "news" },
  news_views: { label: "News · Views per artikel (dari report)", group: "news", channel: "news" },
  social_log: { label: "Sosmed · Publishing log", group: "social_log", channel: "social" },
};

export const SOURCE_GROUPS: { value: SourceGroup; label: string; hint: string }[] = [
  { value: "auto", label: "Deteksi otomatis", hint: "Jenis file ditebak dari header-nya." },
  { value: "ga4", label: "Website · GA4", hint: "CSV dari GA4: Traffic acquisition, Pages and screens, Landing page, Demographic City, overview." },
  { value: "gsc", label: "Website · Search Console", hint: "XLSX lengkap dari GSC (Export → Excel) atau CSV Queries/Pages/Chart." },
  { value: "youtube", label: "YouTube Studio", hint: "Table data.csv, Chart data.csv, Totals.csv (atau ZIP-nya), dan/atau publishing log." },
  { value: "meta", label: "Social · Meta Business Suite", hint: "CSV export konten Instagram / Facebook." },
  { value: "news", label: "News · Content Logs", hint: "Export Google Sheets log artikel (CSV/XLSX), termasuk report News." },
  { value: "social_log", label: "Social · Publishing log", hint: "Export Google Sheets log posting sosmed (CSV/XLSX)." },
];

/** Key yang boleh digabung jika muncul lebih dari sekali dalam satu upload. */
export const MERGEABLE: DatasetKey[] = ["news_log", "news_views", "social_log", "yt_log", "meta_instagram", "meta_facebook", "ga4_overview"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  website: "Website",
  news: "News",
  youtube: "YouTube",
  social: "Social Media",
};

export const FORMAT_LABEL: Record<string, string> = {
  reels: "Reels",
  carousel: "Carousel",
  feeds: "Feeds",
  video: "Video",
  photo: "Foto",
  story: "Stories",
  shorts: "Shorts",
  text: "Teks",
  link: "Link",
  lainnya: "Lainnya",
};

export const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
};

/** Kuota bulanan default (bisa diubah di halaman Import → Kuota). */
export const QUOTA_DEFAULTS: { key: string; label: string; value: number }[] = [
  { key: "news", label: "Artikel News", value: 60 },
  { key: "social", label: "Post sosmed (semua format, dari Publishing Log)", value: 60 },
  { key: "youtube", label: "Video YouTube", value: 4 },
];

/** Field input manual per channel (fallback jika file tidak tersedia). */
export const MANUAL_FIELDS: Record<Channel, { key: string; label: string; unit?: "percent" | "seconds" }[]> = {
  website: [
    { key: "users", label: "Users (total)" },
    { key: "newUsers", label: "New users" },
    { key: "sessions", label: "Sessions" },
    { key: "engagedSessions", label: "Engaged sessions" },
    { key: "pageviews", label: "Views / pageviews" },
    { key: "engagementRate", label: "Engagement rate (%)", unit: "percent" },
    { key: "avgEngagementTime", label: "Avg engagement time per sesi (detik)", unit: "seconds" },
    { key: "gscClicks", label: "GSC clicks" },
    { key: "gscImpressions", label: "GSC impressions" },
    { key: "gscPosition", label: "GSC avg position" },
  ],
  news: [
    { key: "published", label: "Artikel published" },
    { key: "inReview", label: "Artikel in review" },
    { key: "totalViews", label: "Total views artikel" },
  ],
  youtube: [
    { key: "views", label: "Views" },
    { key: "watchHours", label: "Watch time (jam)" },
    { key: "subsGained", label: "Subscribers gained" },
    { key: "subsLost", label: "Subscribers lost" },
    { key: "impressions", label: "Impressions" },
    { key: "ctr", label: "Impressions CTR (%)", unit: "percent" },
    { key: "avgViewDurationSec", label: "Avg view duration (detik)", unit: "seconds" },
    { key: "published", label: "Video published" },
  ],
  social: [
    { key: "posts", label: "Posts published" },
    { key: "reach", label: "Total reach" },
    { key: "views", label: "Total views" },
    { key: "interactions", label: "Total interactions" },
    { key: "follows", label: "Follows" },
  ],
};
