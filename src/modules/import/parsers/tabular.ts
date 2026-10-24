// Membaca file (CSV / XLSX / ZIP) menjadi daftar RawTable.
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { unzipSync } from "fflate";
import type { InputFile, RawTable } from "./types";
import { parseDate, type Cell } from "./values";

function decodeText(data: Uint8Array): string {
  if (data[0] === 0xff && data[1] === 0xfe) return new TextDecoder("utf-16le").decode(data.subarray(2));
  if (data[0] === 0xfe && data[1] === 0xff) return new TextDecoder("utf-16be").decode(data.subarray(2));
  return new TextDecoder("utf-8").decode(data).replace(/^﻿/, "");
}

function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim() !== "" && !l.trimStart().startsWith("#")) ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, line.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Ambil Start/End date dari komentar GA4 ("# Start date: 20260901" / "# Tanggal mulai: ..."). */
function datesFromComments(comments: string[]): { startDate?: string; endDate?: string } {
  const out: { startDate?: string; endDate?: string } = {};
  for (const c of comments) {
    const m = c.match(/#\s*(start date|tanggal mulai|end date|tanggal akhir|tanggal selesai)\s*:\s*(\S+)/i);
    if (!m) continue;
    const d = parseDate(m[2])?.date;
    if (!d) continue;
    if (/start|mulai/i.test(m[1])) out.startDate = d;
    else out.endDate = d;
  }
  return out;
}

/** Rentang tanggal dari nama file/folder, mis. "Content 2026-09-01_2026-10-01 September". */
function datesFromName(name: string): { startDate?: string; endDate?: string } {
  const m = name.match(/(\d{4}-\d{2}-\d{2})[_ ](\d{4}-\d{2}-\d{2})/);
  if (!m) return {};
  // tanggal akhir pada export YouTube bersifat eksklusif
  const end = new Date(m[2] + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() - 1);
  return { startDate: m[1], endDate: end.toISOString().slice(0, 10) };
}

function readCsv(name: string, data: Uint8Array): RawTable[] {
  const text = decodeText(data);
  const delimiter = detectDelimiter(text);
  const parsed = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false });
  const rows = parsed.data;

  type Block = { comments: string[]; rows: Cell[][] };
  const blocks: Block[] = [];
  let pending: string[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current && current.rows.length) blocks.push(current);
    current = null;
  };
  for (const row of rows) {
    const first = String(row[0] ?? "").trim();
    const blank = row.every((c) => String(c ?? "").trim() === "");
    if (first.startsWith("#")) {
      flush();
      pending.push(row.join(delimiter));
      continue;
    }
    if (blank) {
      flush();
      continue;
    }
    if (!current) {
      current = { comments: pending, rows: [] };
      pending = [];
    }
    current.rows.push(row);
  }
  flush();

  const fileComments = blocks[0]?.comments ?? [];
  const fileDates = { ...datesFromName(name), ...datesFromComments(fileComments) };
  const title = fileComments
    .map((c) => c.replace(/^#\s*/, "").trim())
    .find((c) => c && !/^-+$/.test(c) && !/^(account|akun|property|properti)\s*:/i.test(c));

  return blocks.map((b, i) => {
    const own = datesFromComments(b.comments);
    return {
      file: name,
      sheet: blocks.length > 1 ? `blok ${i + 1}` : undefined,
      rows: b.rows,
      comments: b.comments,
      startDate: own.startDate ?? fileDates.startDate,
      endDate: own.endDate ?? fileDates.endDate,
      title,
      blockCount: blocks.length,
    };
  });
}

/** Baca sheet XLSX sel per sel; sel berformat persen diubah ke string "x%" supaya tidak ambigu. */
function sheetRows(ws: XLSX.WorkSheet): Cell[][] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: Cell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: Cell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      if (!cell || cell.v === undefined || cell.v === null) {
        row.push(null);
        continue;
      }
      if (cell.t === "n" && typeof cell.z === "string" && cell.z.includes("%")) {
        row.push(`${(cell.v as number) * 100}%`);
      } else if (cell.t === "d" && cell.v instanceof Date) {
        row.push(cell.v);
      } else {
        row.push(cell.v as Cell);
      }
    }
    rows.push(row);
  }
  // buang baris kosong di akhir
  while (rows.length && rows[rows.length - 1].every((c) => c === null || String(c).trim() === "")) rows.pop();
  return rows;
}

/** Baris "Date | Sep 1, 2026-Sep 30, 2026" dari sheet/CSV Filters Search Console → rentang tanggal. */
function rangeFromFilterRows(rows: Cell[][]): { startDate?: string; endDate?: string } {
  for (const row of rows) {
    if (/^(date|tanggal)$/i.test(String(row[0] ?? "").trim())) {
      const parts = String(row[1] ?? "").split(/\s+-\s+|(?<=\d{4})\s*-\s*/);
      return { startDate: parseDate(parts[0])?.date, endDate: parts[1] ? parseDate(parts[1])?.date : undefined };
    }
  }
  return {};
}

function readXlsx(name: string, data: Uint8Array): RawTable[] {
  const wb = XLSX.read(data, { type: "array", cellDates: false, cellNF: true });
  // GSC: sheet "Filters" berisi rentang tanggal
  let startDate: string | undefined;
  let endDate: string | undefined;
  const filters = wb.SheetNames.find((n) => /^(filters|filter)$/i.test(n));
  if (filters) ({ startDate, endDate } = rangeFromFilterRows(sheetRows(wb.Sheets[filters])));
  const nameDates = datesFromName(name);
  return wb.SheetNames.filter((n) => n !== filters).map((n) => ({
    file: name,
    sheet: n,
    rows: sheetRows(wb.Sheets[n]),
    comments: [],
    startDate: startDate ?? nameDates.startDate,
    endDate: endDate ?? nameDates.endDate,
    blockCount: 1,
  }));
}

export function readTables(file: InputFile): { tables: RawTable[]; errors: string[] } {
  const lower = file.name.toLowerCase();
  const errors: string[] = [];
  try {
    if (lower.endsWith(".zip")) {
      const entries = unzipSync(file.data);
      const tables: RawTable[] = [];
      let range: { startDate?: string; endDate?: string } = {};
      for (const [path, data] of Object.entries(entries)) {
        if (path.endsWith("/") || path.startsWith("__MACOSX") || path.split("/").pop()!.startsWith(".")) continue;
        // Filters.csv (export CSV Search Console) berisi rentang tanggal untuk semua tabel di zip
        if (/(^|\/)filters?\.csv$/i.test(path)) {
          range = rangeFromFilterRows(Papa.parse<string[]>(decodeText(data), { skipEmptyLines: true }).data);
          continue;
        }
        // nama zip ikut dipakai supaya rentang tanggal di nama file zip terbaca
        const r = readTables({ name: `${file.name.replace(/\.zip$/i, "")}/${path}`, data });
        tables.push(...r.tables);
        errors.push(...r.errors);
      }
      if (range.startDate) {
        for (const t of tables) {
          if (!t.startDate) Object.assign(t, range);
        }
      }
      return { tables, errors };
    }
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm")) {
      return { tables: readXlsx(file.name, file.data), errors };
    }
    if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
      return { tables: readCsv(file.name, file.data), errors };
    }
    if (lower.endsWith(".pdf")) {
      errors.push(`${file.name}: PDF files aren't supported — re-export as CSV (GA4: Share → Download file → CSV).`);
      return { tables: [], errors };
    }
    errors.push(`${file.name}: unrecognized file format (use .csv, .xlsx, or .zip).`);
  } catch (e) {
    errors.push(`${file.name}: failed to read (${(e as Error).message}).`);
  }
  return { tables: [], errors };
}
