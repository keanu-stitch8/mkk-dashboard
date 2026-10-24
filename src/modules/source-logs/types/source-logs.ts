import type { DatasetKey } from "@/lib/parsers/types";

/** File log Google Sheets yang tersimpan untuk satu bulan + sumber. */
export interface SourceLogImport {
  fileName: string;
  fileUrl: string | null;
  note: string | null;
  createdAt: Date;
  /** jumlah baris (log) atau jumlah item in review (tracker) */
  count: number | null;
}

export interface SourceLogDef {
  key: DatasetKey;
  channel: string;
  data: string;
  file: string;
}

export interface SourceLogs {
  month: string;
  /** 6 bulan terakhir, terbaru dulu */
  history: string[];
  sources: SourceLogDef[];
  /** `${month}|${source}` → import */
  imports: Record<string, SourceLogImport>;
}
