import { applyMonth, rowCount, type ParseResult } from "@/lib/parsers";
import { DATASETS } from "@/lib/sources";
import type { UploadPreviewDataset } from "../types/upload";

const clip = (v: unknown): unknown => (typeof v === "string" && v.length > 80 ? v.slice(0, 79) + "…" : v);

/** Dataset hasil parse → pratinjau untuk bulan terpilih + import lama yang akan diganti. */
export function buildUploadPreview(parsed: ParseResult, month: string | null, existing: { source: string; fileName: string; createdAt: Date }[]): UploadPreviewDataset[] {
  return parsed.datasets.map((raw) => {
    const ds = month ? applyMonth(raw, month) : raw;
    const old = existing.find((e) => e.source === ds.key);
    return {
      key: ds.key,
      label: DATASETS[ds.key].label,
      file: ds.file,
      sheet: ds.sheet ?? null,
      detectedMonth: raw.month,
      rowCount: rowCount(ds),
      totalRows: rowCount(raw),
      columns: ds.columns,
      unmatched: ds.unmatched,
      warnings: ds.warnings,
      metrics: ds.metrics,
      sample: ds.rows.slice(0, 5).map((r) => {
        const { _date, ...rest } = r;
        void _date;
        return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, clip(v)]));
      }),
      replaces: old ? { fileName: old.fileName, createdAt: old.createdAt } : null,
    };
  });
}
