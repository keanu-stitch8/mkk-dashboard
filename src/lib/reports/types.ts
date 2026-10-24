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
  /** tabel berteks panjang (judul/URL) yang tinggi barisnya disesuaikan isi setelah diisi */
  autoHeight?: string[];
  /** key nilai yang barisnya disembunyikan (mis. In review bernilai 0) — tidak tampil di PDF & chart */
  hideRows?: string[];
  /** peringatan dari data (mis. kategori tanpa baris di laporan) — ditampilkan bersama peringatan penanda */
  warnings?: string[];
  /** tabel yang baris terakhirnya tanpa garis bawah (garis di batas halaman PDF ikut tercetak di atas halaman berikut) */
  openEnd?: string[];
}

export interface ReportChannel {
  id: ReportChannelId;
  /** dipakai di nama file: "MKK {title} Monthly Performance Report – {Month YYYY}" */
  title: string;
  /** nama env berisi ID file master template */
  templateEnv: string;
  build(month: string): Promise<ReportData>;
}
