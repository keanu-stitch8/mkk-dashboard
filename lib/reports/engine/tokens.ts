// Mesin template laporan (murni, tanpa Google): grid sel berpenanda {{…}} + data → rencana perubahan.
//   {{key}}           → nilai dari data.values (sel persis penanda = nilai bertipe; di dalam teks = string)
//   {{#tabel.kolom}}  → baris contoh tabel: digandakan sebanyak baris data (format & merge baris contoh diulang)
//   {{pagebreak}}     → sel dikosongkan; PDF memulai halaman baru di baris ini
import type { Cell, ReportData, Tone } from "../types";

export interface Merge {
  startRow: number; // 0-based, end eksklusif
  endRow: number;
  startCol: number;
  endCol: number;
}
export interface SheetGrid {
  sheetId: number;
  title: string;
  rows: string[][];
  merges: Merge[];
  /** sheet tersembunyi (mis. Ref) tidak ikut PDF */
  hidden?: boolean;
}
export interface Write {
  sheetTitle: string;
  row: number;
  col: number;
  value: Cell;
  tone?: Tone;
}
export interface Plan {
  /** sisip `count` baris pada indeks `at` (sudah memperhitungkan sisipan sebelumnya; jalankan berurutan) */
  inserts: { sheetId: number; at: number; count: number }[];
  merges: (Merge & { sheetId: number })[];
  writes: Write[];
  warnings: string[];
  /** rentang baris (posisi akhir) tabel `data.autoHeight` → tinggi baris disesuaikan isi */
  autoHeight: { sheetId: number; startRow: number; endRow: number }[];
  /** baris (posisi akhir) tempat PDF memulai halaman baru */
  pageBreaks: { sheetId: number; row: number }[];
}

const TOKEN = /\{\{\s*(#?[\w.-]+)\s*\}\}/g;
const EXACT = /^\{\{\s*(#?[\w.-]+)\s*\}\}$/;
const keysIn = (text: string) => [...text.matchAll(TOKEN)].map((m) => m[1]);
const a1 = (row: number, col: number) => `${String.fromCharCode(65 + col)}${row + 1}`;
const fmt = (v: Cell) => (v == null ? "" : typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v);

export function planFill(grids: SheetGrid[], data: ReportData): Plan {
  const plan: Plan = { inserts: [], merges: [], writes: [], warnings: [], autoHeight: [], pageBreaks: [] };

  for (const g of grids) {
    let offset = 0; // baris yang sudah disisipkan di atas baris ini
    const unknown = (r: number, col: number, key: string) => plan.warnings.push(`${g.title}!${a1(r, col)}: penanda "${key}" tidak dikenal`);

    /** Cari nilai penanda; `rec` = baris tabel untuk penanda {{#…}}. */
    const lookup = (key: string, rec: Record<string, Cell> | null): { ok: boolean; value: Cell } => {
      if (key.startsWith("#")) {
        const col = key.slice(1).split(".").slice(1).join(".");
        return rec && col in rec ? { ok: true, value: rec[col] } : { ok: false, value: null };
      }
      return key in data.values ? { ok: true, value: data.values[key] } : { ok: false, value: null };
    };

    /** Isi satu sel → Write (atau null jika tidak ada yang berubah). */
    const resolve = (text: string, r: number, col: number, outRow: number, rec: Record<string, Cell> | null): Write | null => {
      const exact = text.match(EXACT);
      if (exact?.[1] === "pagebreak") {
        plan.pageBreaks.push({ sheetId: g.sheetId, row: outRow });
        return { sheetTitle: g.title, row: outRow, col, value: "" };
      }
      if (exact) {
        const { ok, value } = lookup(exact[1], rec);
        if (!ok) {
          unknown(r, col, exact[1]);
          return null;
        }
        const tone = data.tones?.[exact[1]];
        return { sheetTitle: g.title, row: outRow, col, value: value ?? "", ...(tone ? { tone } : {}) };
      }
      let changed = false;
      const out = text.replace(TOKEN, (whole, key: string) => {
        const { ok, value } = lookup(key, rec);
        if (!ok) {
          unknown(r, col, key);
          return whole;
        }
        changed = true;
        return fmt(value);
      });
      return changed ? { sheetTitle: g.title, row: outRow, col, value: out } : null;
    };

    g.rows.forEach((cells, r) => {
      const row = r + offset;
      const tables = [...new Set(cells.flatMap((c) => keysIn(c ?? "").filter((k) => k.startsWith("#")).map((k) => k.slice(1).split(".")[0])))];

      // baris biasa
      if (!tables.length) {
        cells.forEach((text, col) => {
          if (!text || !keysIn(text).length) return;
          const w = resolve(text, r, col, row, null);
          if (w) plan.writes.push(w);
        });
        return;
      }

      // baris contoh tabel
      const name = tables[0];
      if (tables.length > 1) plan.warnings.push(`${g.title}!${a1(r, 0)}: lebih dari satu tabel di satu baris (${tables.join(", ")}) — hanya "${name}" dipakai`);
      const records = data.tables[name];
      if (!records) {
        plan.warnings.push(`${g.title}!${a1(r, 0)}: tabel "${name}" tidak dikenal`);
        return;
      }
      if (!records.length) {
        let first = true;
        cells.forEach((text, col) => {
          if (!text || !keysIn(text).some((k) => k.startsWith("#"))) return;
          plan.writes.push({ sheetTitle: g.title, row, col, value: first ? "—" : "" });
          first = false;
        });
        return;
      }
      if (records.length > 1) {
        plan.inserts.push({ sheetId: g.sheetId, at: row + 1, count: records.length - 1 });
        const rowMerges = g.merges.filter((m) => m.startRow === r && m.endRow === r + 1);
        for (let i = 1; i < records.length; i++)
          for (const m of rowMerges) plan.merges.push({ sheetId: g.sheetId, startRow: row + i, endRow: row + i + 1, startCol: m.startCol, endCol: m.endCol });
      }
      if (data.autoHeight?.includes(name)) plan.autoHeight.push({ sheetId: g.sheetId, startRow: row, endRow: row + records.length });
      records.forEach((rec, i) => {
        cells.forEach((text, col) => {
          if (!text) return;
          if (!keysIn(text).length) {
            // teks statis di baris contoh: baris sisipan hanya mewarisi format, jadi teksnya ditulis ulang
            if (i > 0) plan.writes.push({ sheetTitle: g.title, row: row + i, col, value: text });
            return;
          }
          const w = resolve(text, r, col, row + i, rec);
          if (w) plan.writes.push(w);
        });
      });
      offset += records.length - 1;
    });
  }
  return plan;
}
