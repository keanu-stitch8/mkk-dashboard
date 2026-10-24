/** Baris form kuota: default tersimpan + nilai khusus bulan ini (null = ikut default). */
export interface QuotaFormRow {
  key: string;
  label: string;
  defaultValue: number;
  monthValue: number | null;
}

export interface ImportPage {
  month: string;
  /** channel → key → nilai input manual bulan ini */
  manual: Record<string, Record<string, number>>;
  quotaRows: QuotaFormRow[];
  /** connector yang kredensialnya lengkap */
  configured: string[];
  currentMonth: string;
}
