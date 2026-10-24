export interface QuotaSummary {
  channel: "news" | "youtube" | "social";
  label: string;
  unit: string;
  published: number;
  /** jumlah yang dihitung ke kuota (News: published + in review = delivered) */
  achieved: number;
  achievedLabel: string;
  target: number;
  /** achieved ÷ target */
  rate: number | null;
  /** bagian-bagian bar bertumpuk (mis. Published + In review); kosong = bar tunggal */
  segments: { label: string; count: number; color: string }[];
  /** false jika belum ada data yang bisa dinilai untuk bulan ini */
  available: boolean;
  /** rincian; target null = hanya jumlah (tanpa target per item) */
  breakdown: { label: string; count: number; target: number | null; rate: number | null }[];
  note?: string;
  source?: string;
}
