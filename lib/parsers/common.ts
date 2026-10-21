import type { HeaderMatch } from "./headers";
import type { Dataset, DatasetKey, RawTable, RecordRow } from "./types";
import { toMonth, type Cell } from "./values";
import { monthLabel } from "../month";

export function dataRows<F extends string>(table: RawTable, m: HeaderMatch<F>): Cell[][] {
  return table.rows
    .slice(m.headerRow + 1)
    .filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""));
}

const lastDay = (month: string) => {
  const [y, mo] = month.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};

/** Bulan dari rentang tanggal tabel + peringatan jika bukan satu bulan penuh. */
export function monthFromRange(table: RawTable, warnings: string[]): string | null {
  const month = toMonth(table.startDate);
  if (!month) return null;
  const endMonth = toMonth(table.endDate);
  const fullStart = table.startDate!.endsWith("-01");
  const fullEnd = table.endDate ? Number(table.endDate.slice(8, 10)) === lastDay(endMonth ?? month) : true;
  if ((endMonth && endMonth !== month) || !fullStart || !fullEnd) {
    warnings.push(
      `The file's date range ${table.startDate} to ${table.endDate ?? "?"} isn't a full month — data is attributed to ${monthLabel(month)}.`,
    );
  }
  return month;
}

/** Bulan yang paling sering muncul di kolom `_date`. */
export function dominantMonth(rows: RecordRow[]): string | null {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const m = toMonth(r._date ?? null);
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [m, c] of counts) if (c > n) [best, n] = [m, c];
  return best;
}

export function makeDataset<F extends string>(
  key: DatasetKey,
  table: RawTable,
  match: HeaderMatch<F> | null,
  init: Partial<Dataset>,
): Dataset {
  return {
    key,
    file: table.file,
    sheet: table.sheet,
    month: null,
    range: table.startDate ? { start: table.startDate, end: table.endDate ?? null } : null,
    rowDated: false,
    priority: 0,
    columns: match ? match.detected.map((d) => ({ field: d.field, header: d.header })) : [],
    unmatched: match ? match.unmatched : [],
    rows: [],
    metrics: [],
    breakdowns: [],
    warnings: [],
    ...init,
  };
}

export const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

/** Baris total ("Total", "Grand total", "Jumlah") di kolom pertama. */
export const isTotalLabel = (v: Cell) => /^(total|totals|grand total|jumlah|total keseluruhan)$/i.test(String(v ?? "").trim());

/** Normalisasi status publikasi → publish | review | draft | (lowercase asli). */
export function normalizeStatus(v: Cell): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (/^(publish|published|terbit|tayang|live|posted|done|selesai|upload|uploaded|sudah (publish|tayang|upload))/.test(s)) return "publish";
  if (/(review|revisi|revision|editing|approval|menunggu|in progress|proses)/.test(s)) return "review";
  if (/^(draft|ide|idea|planning|plan|rencana|todo|to do|belum)/.test(s)) return "draft";
  if (/^(cancel|batal|dibatalkan|drop)/.test(s)) return "canceled";
  return s;
}

/** Cari URL di sel mana pun dalam baris (untuk kolom URL tanpa header). */
export function findUrlInRow(row: Cell[], pattern = /^https?:\/\//i): string | null {
  for (const c of row) {
    const s = String(c ?? "").trim();
    if (pattern.test(s)) return s;
  }
  return null;
}

export function youtubeId(url: string | null | undefined): string | null {
  const m = String(url ?? "").match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
