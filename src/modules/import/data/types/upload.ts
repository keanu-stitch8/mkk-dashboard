import type { DatasetKey, MetricOut } from "@/lib/parsers/types";

/** Pratinjau satu dataset hasil parse file upload (sebelum disimpan). */
export interface UploadPreviewDataset {
  key: DatasetKey;
  label: string;
  file: string;
  sheet: string | null;
  detectedMonth: string | null;
  /** baris yang masuk bulan terpilih */
  rowCount: number;
  totalRows: number;
  /** kolom file yang dikenali → field */
  columns: { field: string; header: string }[];
  unmatched: string[];
  warnings: string[];
  metrics: MetricOut[];
  /** 5 baris pertama, teks panjang dipotong */
  sample: Record<string, unknown>[];
  /** import bulan & sumber yang sama yang akan diganti */
  replaces: { fileName: string; createdAt: Date } | null;
}
