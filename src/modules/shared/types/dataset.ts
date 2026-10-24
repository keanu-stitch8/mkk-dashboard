// Kunci channel & dataset dipakai lintas modul (shared, import, connectors, laporan), jadi tinggal di shared.
export type Channel = "website" | "news" | "youtube" | "social";

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
  | "meta_ig_stories"
  | "news_log"
  | "news_views"
  | "social_log"
  | "social_review"
  | "yt_review";

export type SourceGroup = "auto" | "ga4" | "gsc" | "youtube" | "meta" | "news" | "social_log";
