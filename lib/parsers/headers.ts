// Pencocokan header fleksibel: case-insensitive, trim, alias English & Indonesia.
import type { Cell } from "./values";

export function normalizeHeader(h: Cell): string {
  return String(h ?? "")
    .replace(/^﻿/, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Definisi field: nama internal → daftar alias (akan dinormalisasi). */
export type FieldSpec = Record<string, readonly string[]>;

export interface HeaderMatch<F extends string> {
  headerRow: number;
  columns: Partial<Record<F, number>>;
  /** header asli per kolom yang terdeteksi */
  detected: { field: F; header: string; index: number }[];
  unmatched: string[];
}

/** Cocokkan satu baris header dengan spec. Alias exact match didahulukan, lalu prefix match. */
export function matchHeaderRow<F extends string>(row: Cell[], spec: Record<F, readonly string[]>): HeaderMatch<F> {
  const norm = row.map(normalizeHeader);
  const columns: Partial<Record<F, number>> = {};
  const used = new Set<number>();
  const fields = Object.keys(spec) as F[];
  // pass 1: exact
  for (const f of fields) {
    const aliases = spec[f].map(normalizeHeader);
    const idx = norm.findIndex((h, i) => !used.has(i) && h !== "" && aliases.includes(h));
    if (idx >= 0) {
      columns[f] = idx;
      used.add(idx);
    }
  }
  // pass 2: prefix (mis. "Session primary channel group (Default Channel Group)")
  for (const f of fields) {
    if (columns[f] !== undefined) continue;
    const aliases = spec[f].map(normalizeHeader).filter((a) => a.length >= 6);
    const idx = norm.findIndex((h, i) => !used.has(i) && h !== "" && aliases.some((a) => h.startsWith(a + " ")));
    if (idx >= 0) {
      columns[f] = idx;
      used.add(idx);
    }
  }
  const detected = fields
    .filter((f) => columns[f] !== undefined)
    .map((f) => ({ field: f, header: String(row[columns[f]!] ?? "").trim(), index: columns[f]! }));
  const unmatched = row
    .map((h, i) => (used.has(i) ? null : String(h ?? "").trim()))
    .filter((h): h is string => !!h);
  return { headerRow: -1, columns, detected, unmatched };
}

/**
 * Cari baris header dalam `rows` (maks `scan` baris pertama) yang memuat semua field `required`.
 * Mengembalikan baris dengan jumlah field cocok terbanyak.
 */
export function findHeader<F extends string>(
  rows: Cell[][],
  spec: Record<F, readonly string[]>,
  required: F[],
  scan = 40,
): HeaderMatch<F> | null {
  let best: HeaderMatch<F> | null = null;
  for (let i = 0; i < Math.min(rows.length, scan); i++) {
    const row = rows[i];
    if (!row || row.filter((c) => String(c ?? "").trim() !== "").length < Math.min(2, required.length)) continue;
    const m = matchHeaderRow(row, spec);
    if (!required.every((f) => m.columns[f] !== undefined)) continue;
    if (!best || m.detected.length > best.detected.length) best = { ...m, headerRow: i };
  }
  return best;
}

export function getCell<F extends string>(row: Cell[], m: HeaderMatch<F>, f: F): Cell {
  const idx = m.columns[f];
  return idx === undefined ? undefined : row[idx];
}
