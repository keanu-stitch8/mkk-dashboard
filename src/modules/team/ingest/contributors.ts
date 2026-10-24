// "MKK Kudus Local Contributor - Task Progress": satu tab per bulan, dua baris header (grup + sub-kolom).
// Satu baris = satu rencana liputan kontributor lokal: artikel + empat aset footage, masing-masing dengan
// status (Available / Not Available), penanggung jawab (alias), link Drive, dan tanggal kirim. Murni, tanpa I/O.
import { dominantMonth } from "@/modules/import/parsers/common";
import type { RawTable } from "@/modules/import/parsers/types";
import { parseDate, str, type Cell } from "@/modules/import/parsers/values";
import { panduanDate } from "./parse";

export type AssetKey = "landscape" | "portrait" | "video" | "interview";

export const ASSETS: { key: AssetKey; label: string; header: RegExp }[] = [
  { key: "landscape", label: "Landscape photo", header: /^(landscape|stock) photo$/i },
  { key: "portrait", label: "Portrait photo", header: /^portrait photo$/i },
  { key: "video", label: "Portrait video", header: /^portrait video$/i },
  { key: "interview", label: "Interview video", header: /^interview video$/i },
];

/** available = ada, missing = kontributor menyatakan tidak ada, null = belum diisi ("-" / kosong) */
export type AssetState = "available" | "missing" | null;

export interface AssetCell {
  state: AssetState;
  by: string | null;
  at: string | null;
}

export interface ContributorRow {
  no: number;
  planned: string | null;
  /** file panduan liputan hari itu (kolom "Brief", di-merge per hari → diteruskan) */
  guideFile: string | null;
  /** urutan rencana di hari itu (1, 2, …) */
  n: number;
  title: string;
  status: string | null;
  articleBy: string | null;
  articleAt: string | null;
  assets: Record<AssetKey, AssetCell>;
}

const text = (c: Cell) => str(c).trim() || null;
const date = (c: Cell) => parseDate(c)?.date ?? null;

function assetState(c: Cell): AssetState {
  const s = str(c).trim().toLowerCase();
  if (/^not\s*available$|^n\/?a$|^tidak ada$/.test(s)) return "missing";
  if (/^available$|^ada$/.test(s)) return "available";
  return null;
}

/** Satu tab bulan → baris liputan. null jika bukan tab Task Progress kontributor. */
export function readContributorTab(table: RawTable): { tab: string; rows: ContributorRow[] } | null {
  const h = table.rows.slice(0, 10).findIndex((r) => r.some((c) => /^planned date$/i.test(str(c))) && r.some((c) => /^artikel$/i.test(str(c))));
  if (h < 0) return null;
  const top = table.rows[h].map((c) => str(c).trim());
  const sub = (table.rows[h + 1] ?? []).map((c) => str(c).trim());
  const col = (row: string[], re: RegExp) => row.findIndex((c) => re.test(c));
  const dateCol = col(top, /^planned date$/i);
  const titleCol = col(top, /^artikel$/i);
  const guideCol = col(top, /^brief$/i);
  const statusCol = col(top, /^status$/i);
  // grup Article: Assignee, Link, Submitted Date pertama di sub-header
  const articleCol = col(top, /^article/i);
  const assetCols = ASSETS.map((a) => ({ ...a, i: col(sub, a.header) }));
  if (dateCol < 0 || titleCol < 0 || assetCols.every((a) => a.i < 0)) return null;

  const data = table.rows.slice(h + 2);
  const tab = dominantMonth(data.map((r) => ({ _date: date(r[dateCol]) })));
  if (!tab) return null;

  const rows: ContributorRow[] = [];
  let planned: string | null = null;
  let guideFile: string | null = null;
  let n = 0;
  data.forEach((r, i) => {
    const d = date(r[dateCol]);
    if (d && d !== planned) {
      planned = d;
      guideFile = null;
      n = 0;
    }
    guideFile = text(r[guideCol]) ?? guideFile;
    const title = text(r[titleCol]);
    if (!title) return;
    n++;
    const at = (k: number) => (k >= 0 ? r[k] : null);
    rows.push({
      no: Number(r[0]) || i + 1,
      planned,
      guideFile,
      n,
      title: title.replace(/\s+/g, " "),
      status: statusCol >= 0 ? (text(r[statusCol])?.toLowerCase() ?? null) : null,
      articleBy: articleCol >= 0 ? text(at(articleCol)) : null,
      articleAt: articleCol >= 0 ? date(at(articleCol + 2)) : null,
      assets: Object.fromEntries(
        assetCols.map((a) => [a.key, a.i < 0 ? { state: null, by: null, at: null } : { state: assetState(at(a.i)), by: text(at(a.i + 1)), at: date(at(a.i + 3)) }]),
      ) as Record<AssetKey, AssetCell>,
    });
  });
  return { tab, rows };
}

/** Tab "Ref": alias kontributor → nama lengkap. */
export function readContributorNames(table: RawTable): Map<string, string> | null {
  const h = table.rows.slice(0, 5).findIndex((r) => r.some((c) => /alias$/i.test(str(c))));
  if (h < 0) return null;
  const head = table.rows[h].map((c) => str(c).trim());
  const nameCol = head.findIndex((c) => /^(journalist|contributor|kontributor|nama|name)$/i.test(c));
  const aliasCol = head.findIndex((c) => /alias$/i.test(c));
  if (nameCol < 0 || aliasCol < 0) return null;
  const out = new Map<string, string>();
  for (const r of table.rows.slice(h + 1)) {
    const alias = text(r[aliasCol]);
    const name = text(r[nameCol]);
    if (alias && name) out.set(alias.toUpperCase(), name.replace(/\s+/g, " "));
  }
  return out;
}

/** Aset lengkap = foto (landscape atau portrait) + video portrait + video wawancara tersedia. */
export function assetSummary(a: Record<AssetKey, AssetCell>) {
  const photo = a.landscape.state === "available" || a.portrait.state === "available";
  const complete = photo && a.video.state === "available" && a.interview.state === "available";
  const reported = ASSETS.some((x) => a[x.key].state !== null);
  const dates = ASSETS.map((x) => a[x.key].at).filter((d): d is string => !!d);
  return {
    complete,
    reported,
    /** bahan reel: video portrait tersedia */
    reelReady: a.video.state === "available",
    lastAsset: dates.sort().at(-1) ?? null,
  };
}

/** Tanggal panduan dari nama file di kolom Brief (fallback: Planned Date). */
export const rowGuideDate = (r: ContributorRow) => (r.guideFile ? panduanDate(r.guideFile) : null) ?? r.planned;
