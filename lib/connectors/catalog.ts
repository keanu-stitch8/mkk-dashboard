// Katalog connector (aman dipakai di client maupun server).

export type ConnectorId = "ga4" | "gsc" | "youtube" | "meta" | "sheets" | "drive";

export interface ConnectorInfo {
  id: ConnectorId;
  label: string;
  description: string;
  /** dataset yang diisi connector (sama dengan hasil import CSV) */
  fills: string;
  /** false = belum dibuat (ditampilkan sebagai "segera") */
  available: boolean;
}

export const CONNECTORS: ConnectorInfo[] = [
  {
    id: "ga4",
    label: "Google Analytics 4",
    description: "Website traffic: users, sessions, traffic sources, views per page (also used for News article views).",
    fills: "GA4 Traffic acquisition, Pages and screens, Landing page, Overview, City",
    available: true,
  },
  {
    id: "gsc",
    label: "Google Search Console",
    description: "Google Search performance: clicks, impressions, CTR, position, top queries & pages.",
    fills: "GSC Queries (top 1000), Pages (top 1000), Dates, Countries, Devices",
    available: true,
  },
  {
    id: "meta",
    label: "Meta (Instagram & Facebook)",
    description: "This month's Instagram & Facebook posts with reach, views, likes, comments, shares, saves (Graph API, system user token).",
    fills: "Meta Instagram / Facebook per post + IG account insights",
    available: true,
  },
  {
    id: "youtube",
    label: "YouTube Analytics",
    description: "Long-form videos published this month: views, watch time, subscribers, likes, impressions & CTR.",
    fills: "YouTube Table data (per video) & daily Totals",
    available: true,
  },
  {
    id: "sheets",
    label: "Google Sheets (Publishing Log)",
    description: "Monthly Publishing Logs from Google Drive: News Content Logs, Socmed Content Logs, and the YouTube Publishing Log (from the performance report). Found automatically by file name + month.",
    fills: "News content log, social publishing log, YouTube publishing log",
    available: true,
  },
  {
    id: "drive",
    label: "Google Drive (Coverage guides & Briefs)",
    description: "Daily coverage guides (YYMMDD_PANDUAN LIPUTAN …) and Content & Creative briefs (YYMMDD_Brief Carousel / Reel - Topic) from Google Drive, matched to articles and Instagram posts. Uses the Google Sheets account.",
    fills: "Stories (planned articles) & Briefs, plus their matches",
    available: true,
  },
];

export const connectorLabel = (id: string) => CONNECTORS.find((c) => c.id === id)?.label ?? id;
