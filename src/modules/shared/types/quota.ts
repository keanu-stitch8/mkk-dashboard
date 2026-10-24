export interface QuotaValue {
  key: string;
  label: string;
  value: number;
  /** true jika nilai khusus bulan ini (bukan default) */
  override: boolean;
}
