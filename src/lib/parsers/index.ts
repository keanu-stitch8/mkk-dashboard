// Entry point parser: file → dataset siap simpan.
import { detectGa4 } from "./ga4";
import { detectGsc } from "./gsc";
import { detectMeta } from "./meta";
import { applyPublishCohort, detectYoutube } from "./youtube";
import { detectNewsLog, detectNewsViews, detectSocialLog } from "./logs";
import { readTables } from "./tabular";
import type { Dataset, InputFile, ParseResult, RawTable, SkipNotice, SourceGroup } from "./types";
import { toMonth } from "./values";
import { DATASETS, MERGEABLE } from "../sources";
import { monthLabel } from "../month";

export type { Dataset, ParseResult, SourceGroup, InputFile } from "./types";

/** Sheet referensi/ringkasan di workbook report yang tidak berisi data mentah. */
const SKIP_SHEET = /^(\d+\s*)?(ref|refs|reference|referensi|list|lists|dropdown|master|settings|pengaturan|metric guide|panduan|executive summary|ringkasan)\b/i;

type Detector = (t: RawTable) => Dataset[] | SkipNotice | null;

// Urutan penting: detector paling spesifik lebih dulu.
const DETECTORS: Detector[] = [detectMeta, detectGsc, detectYoutube, detectGa4, detectNewsViews, detectSocialLog, detectNewsLog];

function detectTable(table: RawTable): Dataset[] | SkipNotice | null {
  for (const d of DETECTORS) {
    const res = d(table);
    // [] = detector tidak mengenali tabel ini → coba detector berikutnya (bukan "header tidak dikenali")
    if (res && (!Array.isArray(res) || res.length)) return res;
  }
  return null;
}

/** Gabungkan dataset ber-key sama dalam satu upload. */
function mergeDatasets(list: Dataset[]): Dataset[] {
  const byKey = new Map<string, Dataset>();
  for (const ds of list) {
    const prev = byKey.get(ds.key);
    if (!prev) {
      byKey.set(ds.key, ds);
      continue;
    }
    if (MERGEABLE.includes(ds.key)) {
      byKey.set(ds.key, {
        ...prev,
        file: prev.file === ds.file ? prev.file : `${prev.file}, ${ds.file}`,
        sheet: [prev.sheet, ds.sheet].filter(Boolean).join(", ") || undefined,
        month: prev.month ?? ds.month,
        columns: [...prev.columns, ...ds.columns.filter((c) => !prev.columns.some((p) => p.field === c.field))],
        unmatched: [...new Set([...prev.unmatched, ...ds.unmatched])],
        rows: [...prev.rows, ...ds.rows],
        // metric dengan key sama: yang pertama menang
        metrics: [...prev.metrics, ...ds.metrics.filter((m) => !prev.metrics.some((p) => p.key === m.key))],
        breakdowns: [...prev.breakdowns, ...ds.breakdowns],
        warnings: [...new Set([...prev.warnings, ...ds.warnings])],
      });
    } else {
      const keep = ds.priority > prev.priority || (ds.priority === prev.priority && ds.rows.length > prev.rows.length) ? ds : prev;
      const drop = keep === ds ? prev : ds;
      keep.warnings = [...keep.warnings, `${drop.file} also contains ${DATASETS[ds.key].label}; using: ${keep.file}.`];
      byKey.set(ds.key, keep);
    }
  }
  return [...byKey.values()];
}

export function parseFiles(files: InputFile[], group: SourceGroup = "auto"): ParseResult {
  const result: ParseResult = { datasets: [], skipped: [], errors: [] };
  const found: Dataset[] = [];
  for (const file of files) {
    const { tables, errors } = readTables(file);
    result.errors.push(...errors);
    for (const table of tables) {
      if (table.sheet && SKIP_SHEET.test(table.sheet)) {
        result.skipped.push({ file: table.file, sheet: table.sheet, reason: "Summary/reference sheet — skipped." });
        continue;
      }
      if (table.rows.length === 0) continue;
      const ds = detectTable(table);
      if (ds && "skip" in ds) {
        result.skipped.push({ file: table.file, sheet: table.sheet, reason: ds.skip, actionable: true });
        continue;
      }
      if (!ds || ds.length === 0) {
        result.skipped.push({ file: table.file, sheet: table.sheet, reason: "Headers not recognized." });
        continue;
      }
      for (const d of ds) {
        if (group !== "auto" && DATASETS[d.key].group !== group) {
          result.skipped.push({
            file: table.file,
            sheet: table.sheet,
            reason: `Detected as ${DATASETS[d.key].label}, not the selected source.`,
          });
          continue;
        }
        found.push(d);
      }
    }
  }
  result.datasets = mergeDatasets(found);
  // dataset harian YouTube: jika ada Totals, data dari Chart data otomatis tersisih via priority
  for (const d of result.datasets) {
    if (d.rowDated && !d.month) d.month = null;
  }
  if (files.length && !result.datasets.length && !result.errors.length) {
    result.errors.push("No recognized tables. Check that the files match the selected source type.");
  }
  return result;
}

function mismatchWarning(ds: Dataset, month: string): string {
  const range = ds.range ? `${fmtDay(ds.range.start)}–${ds.range.end ? fmtDay(ds.range.end) : "?"}` : monthLabel(ds.month!);
  const msg = `This file's data covers ${range} (${monthLabel(ds.month!)}), but it will be saved to ${monthLabel(month)}. Make sure the selected month is correct.`;
  return msg;
}

const fmtDay = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${monthLabel(`${y}-${String(m).padStart(2, "0")}`, true).split(" ")[0]} ${y}`;
};

/**
 * Terapkan bulan target: buang baris di luar bulan (untuk dataset bertanggal)
 * dan beri peringatan jika bulan file berbeda dari bulan target.
 */
export function applyMonth(ds: Dataset, month: string): Dataset {
  const warnings = [...ds.warnings];
  let rows = ds.rows;
  if (ds.rowDated) {
    const inMonth = rows.filter((r) => !r._date || toMonth(r._date) === month);
    const dropped = rows.length - inMonth.length;
    if (dropped) {
      const months = [...new Set(rows.filter((r) => r._date && toMonth(r._date) !== month).map((r) => toMonth(r._date!)!))].sort();
      warnings.push(`${dropped} rows outside ${monthLabel(month)} ignored (${months.map((m) => monthLabel(m)).join(", ")}).`);
    }
    rows = inMonth;
  } else if (ds.month && ds.month !== month) {
    warnings.push(mismatchWarning(ds, month));
  }
  if (ds.rowDated && rows.length === 0) warnings.push(`No rows for ${monthLabel(month)} — this dataset won't be saved.`);
  const out = { ...ds, rows, warnings };
  return ds.key === "yt_table" ? applyPublishCohort(out, month) : out;
}

/** Bulan default untuk satu hasil parse: bulan terdeteksi yang paling umum. */
export function suggestedMonth(result: ParseResult): string | null {
  const counts = new Map<string, number>();
  for (const d of result.datasets) if (d.month) counts.set(d.month, (counts.get(d.month) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function rowCount(ds: Dataset): number {
  return ds.rows.length || ds.breakdowns.length || ds.metrics.length;
}
