// Katalog connector (aman dipakai di client maupun server).

export type ConnectorId = "ga4" | "gsc" | "youtube" | "meta" | "sheets";

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
    description: "Traffic website: users, sessions, sumber traffic, views per halaman (dipakai juga untuk views artikel News).",
    fills: "GA4 Traffic acquisition, Pages and screens, Landing page, Overview, City",
    available: true,
  },
  {
    id: "gsc",
    label: "Google Search Console",
    description: "Performa Google Search: clicks, impressions, CTR, posisi, top query & halaman.",
    fills: "GSC Queries (top 1000), Pages (top 1000), Dates, Countries, Devices",
    available: true,
  },
  {
    id: "youtube",
    label: "YouTube Analytics",
    description: "Video long-form yang dipublish bulan ini: views, watch time, subscriber, likes, impressions & CTR.",
    fills: "YouTube Table data (per video) & Totals harian",
    available: true,
  },
  {
    id: "meta",
    label: "Meta (Instagram & Facebook)",
    description: "Post Instagram & Facebook bulan ini beserta reach, views, likes, comments, shares, saves (Graph API, token system user).",
    fills: "Meta Instagram / Facebook per post + insight akun IG",
    available: true,
  },
  {
    id: "sheets",
    label: "Google Sheets (Publishing Log)",
    description: "Publishing Log bulanan dari Google Drive: News Content Logs, Socmed Content Logs, dan Publishing Log YouTube (dari performance report). Dicari otomatis per nama file + bulan.",
    fills: "News content log, Sosmed publishing log, YouTube publishing log",
    available: true,
  },
];

export const connectorLabel = (id: string) => CONNECTORS.find((c) => c.id === id)?.label ?? id;
