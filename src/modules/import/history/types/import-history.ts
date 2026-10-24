export interface ImportEntry {
  id: string;
  month: string;
  source: string;
  fileName: string;
  fileUrl: string | null;
  rowCount: number;
  createdAt: Date;
}

/** Dataset yang ditulis dalam satu sync / satu sesi upload. */
export interface ImportSession {
  start: Date;
  rows: ImportEntry[];
  totalRows: number;
  /** API sync | Google Sheets | File upload */
  origins: string[];
  /** bulan data dalam sesi, terbaru dulu */
  months: string[];
}

export interface ImportHistory {
  /** jumlah dataset tersimpan */
  total: number;
  sessions: ImportSession[];
  page: number;
  pages: number;
}
