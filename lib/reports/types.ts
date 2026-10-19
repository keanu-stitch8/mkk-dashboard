export type Cell = string | number | null;
/** Warna perubahan KPI: good = hijau, bad = merah, flat/none = abu. */
export type Tone = "good" | "bad" | "flat" | "none";
export type ReportChannelId = "website" | "news" | "youtube" | "social";

export interface ReportData {
  /** {{key}} → nilai */
  values: Record<string, Cell>;
  /** {{#tabel.kolom}} → baris berulang */
  tables: Record<string, Record<string, Cell>[]>;
  /** key nilai yang selnya diwarnai (mis. kpi.views.change) */
  tones?: Record<string, Tone>;
}

export interface ReportChannel {
  id: ReportChannelId;
  /** dipakai di nama file: "MKK {title} Monthly Performance Report – {Month YYYY}" */
  title: string;
  /** nama env berisi ID file master template */
  templateEnv: string;
  build(month: string): Promise<ReportData>;
}
