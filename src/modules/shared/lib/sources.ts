// Katalog sumber data (aman dipakai di client maupun server).
import type { Channel, DatasetKey, SourceGroup } from "@/modules/shared/types/dataset";
import { PLATFORM_LABEL, SOCIAL_FORMAT_LABEL } from "@/modules/shared/lib/taxonomy";

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
  yt_daily: { label: "YouTube · Totals / Chart data (daily)", group: "youtube", channel: "youtube" },
  yt_log: { label: "YouTube · Publishing log", group: "youtube", channel: "youtube" },
  meta_instagram: { label: "Meta · Instagram (per post)", group: "meta", channel: "social" },
  meta_facebook: { label: "Meta · Facebook (per post)", group: "meta", channel: "social" },
  meta_ig_stories: { label: "Meta · Instagram Stories (info, not a KPI)", group: "meta", channel: "social" },
  news_log: { label: "News · Content log (articles)", group: "news", channel: "news" },
  news_views: { label: "News · Views per article (from the report)", group: "news", channel: "news" },
  social_log: { label: "Sosmed · Publishing log", group: "social_log", channel: "social" },
  social_review: { label: "Sosmed · Task Progress (in review)", group: "social_log", channel: "social" },
  yt_review: { label: "YouTube · Calendar Timeline (in review)", group: "youtube", channel: "youtube" },
};

export const SOURCE_GROUPS: { value: SourceGroup; label: string; hint: string }[] = [
  { value: "auto", label: "Auto-detect", hint: "The file type is guessed from its headers." },
  { value: "ga4", label: "Website · GA4", hint: "CSVs from GA4: Traffic acquisition, Pages and screens, Landing page, Demographic City, overview." },
  { value: "gsc", label: "Website · Search Console", hint: "Full XLSX from GSC (Export → Excel) or the Queries/Pages/Chart CSVs." },
  { value: "news", label: "News · Content Logs", hint: "Google Sheets export of the article log (CSV/XLSX), including the News report." },
  { value: "meta", label: "Social · Meta Business Suite", hint: "CSV export of Instagram / Facebook content." },
  { value: "social_log", label: "Social · Publishing log", hint: "Export Google Sheets log posting sosmed (CSV/XLSX)." },
  { value: "youtube", label: "YouTube Studio", hint: "Table data.csv, Chart data.csv, Totals.csv (or their ZIP), and/or the publishing log." },
];

/** Key yang boleh digabung jika muncul lebih dari sekali dalam satu upload. */
export const MERGEABLE: DatasetKey[] = ["news_log", "news_views", "social_log", "yt_log", "meta_instagram", "meta_facebook", "meta_ig_stories", "ga4_overview"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  website: "Website",
  news: "News",
  youtube: "YouTube",
  social: "Social Media",
};

// label format sosmed & platform dari taksonomi bersama (modules/shared/lib/taxonomy.ts): Feed (+ carousel/foto) · Reel · Story · Video
export const FORMAT_LABEL: Record<string, string> = {
  ...SOCIAL_FORMAT_LABEL,
  shorts: "Shorts",
  text: "Text",
  link: "Link",
  lainnya: "Other",
};

export { PLATFORM_LABEL };

/**
 * Akun sosmed milik MKK. Post dari akun lain di export Meta (kolaborasi/repost)
 * tidak dihitung ke performa maupun kuota. Jika tidak ada yang cocok, akun yang
 * paling banyak muncul di bulan itu dianggap akun MKK.
 */
export const OWN_SOCIAL_ACCOUNTS = ["main_ke_kudus", "mainkekudus"];

/**
 * Platform sosmed yang dihitung ke performa dashboard (reach, views, interaksi, follows, top post).
 * Post platform lain tetap boleh tersimpan tapi diabaikan, dan connector Meta hanya menarik platform ini.
 * Kuota tetap dari Publishing Log (semua channel). Tambahkan "facebook" untuk menghitung Facebook lagi.
 */
export const ACTIVE_SOCIAL_PLATFORMS: string[] = ["instagram"];

/** Kuota bulanan default (bisa diubah di halaman Import → Kuota). */
export const QUOTA_DEFAULTS: { key: string; label: string; value: number }[] = [
  { key: "news", label: "News articles", value: 60 },
  { key: "social", label: "Social posts (all formats, from the Publishing Log)", value: 60 },
  { key: "youtube", label: "YouTube videos", value: 4 },
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
    { key: "avgEngagementTime", label: "Avg engagement time per session (seconds)", unit: "seconds" },
    { key: "gscClicks", label: "GSC clicks" },
    { key: "gscImpressions", label: "GSC impressions" },
    { key: "gscPosition", label: "GSC avg position" },
  ],
  news: [
    { key: "published", label: "Articles published" },
    { key: "inReview", label: "Articles in review" },
    { key: "totalViews", label: "Total article views" },
  ],
  youtube: [
    { key: "views", label: "Views" },
    { key: "watchHours", label: "Watch time (hours)" },
    { key: "subsGained", label: "Subscribers gained" },
    { key: "subsLost", label: "Subscribers lost" },
    { key: "impressions", label: "Impressions" },
    { key: "ctr", label: "Impressions CTR (%)", unit: "percent" },
    { key: "avgViewDurationSec", label: "Avg view duration (seconds)", unit: "seconds" },
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
