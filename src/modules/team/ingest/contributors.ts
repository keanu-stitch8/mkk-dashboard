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

const MONTH_NAME = "(jan|feb|mar|apr|mei|may|jun|jul|aug|agu|sep|oct|okt|nov|dec|des)[a-z]*";

/** Nama tab bulan ("September", "Okt", …). Tab lain — mis. salinan "September (cek Drive)" — diabaikan supaya bulan tidak terbaca dua kali. */
export const isMonthTab = (name: string) => new RegExp(`^${MONTH_NAME}$`, "i").test(name.trim());

/** Tab liputan tambahan "<Bulan> Extra Posts" — dihitung sebagai konten bulan itu (sama dengan Master Report). */
export const isExtraTab = (name: string) => new RegExp(`^${MONTH_NAME}\\s+extra(\\s+posts?)?$`, "i").test(name.trim());

/** Satu tab bulan (atau "<Bulan> Extra Posts") → baris liputan. null jika bukan tab Task Progress kontributor. */
export function readContributorTab(table: RawTable): { tab: string; extra: boolean; rows: ContributorRow[] } | null {
  const extra = table.sheet !== undefined && isExtraTab(table.sheet);
  if (table.sheet !== undefined && !isMonthTab(table.sheet) && !extra) return null;
  const h =table.rows.slice(0, 10).findIndex((r) => r.some((c) => /^planned date$/i.test(str(c))) && r.some((c) => /^artikel$/i.test(str(c))));
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
  return { tab, extra, rows };
}

export interface ContributorRef {
  alias: string;
  name: string;
  /** kolom Role, mis. "Journalist, Footage"; null = belum diisi */
  role: string | null;
  /** kolom "News Name": nama lain orang ini di kolom Reporter News Content Logs, mis. "Itun, Fatur" */
  newsNames: string | null;
  /** kolom "Active" (kosong = aktif) */
  active: boolean;
}

/** Tab "Ref": alias kontributor → nama lengkap + peran. */
export function readContributorRefs(table: RawTable): ContributorRef[] | null {
  const h = table.rows.slice(0, 5).findIndex((r) => r.some((c) => /alias$/i.test(str(c))));
  if (h < 0) return null;
  const head = table.rows[h].map((c) => str(c).trim());
  const nameCol = head.findIndex((c) => /^(journalist|contributor|kontributor|nama|name)$/i.test(c));
  const aliasCol = head.findIndex((c) => /alias$/i.test(c));
  const roleCol = head.findIndex((c) => /^(role|peran)$/i.test(c));
  const newsCol = head.findIndex((c) => /^news\s*names?$/i.test(c));
  const activeCol = head.findIndex((c) => /^(active|aktif)$/i.test(c));
  if (nameCol < 0 || aliasCol < 0) return null;
  const out = new Map<string, ContributorRef>();
  for (const r of table.rows.slice(h + 1)) {
    const alias = text(r[aliasCol])?.toUpperCase();
    const name = text(r[nameCol]);
    if (!alias || !name) continue;
    const active = activeCol >= 0 ? !/^(no|n|tidak|inactive|non-?active|false|0)$/i.test(str(r[activeCol]).trim()) : true;
    out.set(alias, { alias, name: name.replace(/\s+/g, " "), role: roleCol >= 0 ? text(r[roleCol]) : null, newsNames: newsCol >= 0 ? text(r[newsCol]) : null, active });
  }
  return [...out.values()];
}

/** Tab "Ref": alias kontributor → nama lengkap. */
export function readContributorNames(table: RawTable): Map<string, string> | null {
  const refs = readContributorRefs(table);
  return refs ? new Map(refs.map((r) => [r.alias, r.name])) : null;
}

// ── Kredit konten (dibayar per konten) ──────────────────────────────────────
// Sama dengan tab "Master Report": 1 konten = 1 artikel berstatus Submitted (aset boleh tidak lengkap).
// Artikel dengan beberapa penulis dibagi rata; orang yang perannya hanya Footage tidak ikut dibagi.
// Footage = jumlah liputan yang minimal satu asetnya atas nama orang itu.

/** "JMY, ITN" / "OEB/YSR" → ["JMY", "ITN"] / ["OEB", "YSR"]. */
export const splitAliases = (s: string | null | undefined): string[] =>
  s ? [...new Set(s.split(/[,/&+]|\s+(?:dan|and)\s+/i).map((x) => x.trim().toUpperCase()).filter(Boolean))] : [];

/** Peran hanya Footage (bukan Journalist) → tidak dihitung sebagai penulis artikel. Peran kosong = penulis. */
export const isFootageOnly = (role: string | null | undefined) => !!role && /footage/i.test(role) && !/journalist|jurnalis|writer|penulis/i.test(role);

export const isDelivered = (status: string | null | undefined) => status?.trim().toLowerCase() === "submitted";

/** Bagian kredit artikel per penulis (jumlahnya 1). Jika semua penulis Footage-only, kredit tetap dibagi ke mereka. */
export function articleCredit(by: string | null | undefined, footageOnly: Set<string>): [string, number][] {
  const all = splitAliases(by);
  const writers = all.filter((a) => !footageOnly.has(a));
  const list = writers.length ? writers : all;
  return list.map((a) => [a, 1 / list.length]);
}

/** Alias yang tercatat di Assignee aset mana pun pada satu liputan (tanpa melihat statusnya, sama dengan Master Report). */
export const footageBy = (assets: Record<AssetKey, Pick<AssetCell, "by">>) => new Set(ASSETS.flatMap((a) => splitAliases(assets[a.key].by)));

export interface ContributorMonthCredit {
  /** artikel Submitted (termasuk Extra Posts) */
  delivered: number;
  /** alias → konten (pecahan jika artikel ditulis bersama) */
  content: Record<string, number>;
  /** alias → jumlah liputan dengan aset atas namanya */
  footage: Record<string, number>;
}

export function monthCredit(rows: { status: string | null; articleBy: string | null; assets: Record<AssetKey, Pick<AssetCell, "by">> }[], footageOnly: Set<string>): ContributorMonthCredit {
  const out: ContributorMonthCredit = { delivered: 0, content: {}, footage: {} };
  for (const r of rows) {
    if (isDelivered(r.status)) {
      out.delivered++;
      for (const [a, share] of articleCredit(r.articleBy, footageOnly)) out.content[a] = (out.content[a] ?? 0) + share;
    }
    for (const a of footageBy(r.assets)) out.footage[a] = (out.footage[a] ?? 0) + 1;
  }
  return out;
}

/**
 * Kolom Reporter News Content Logs → alias kontributor lokal. Nama dicocokkan persis (tanpa beda huruf besar/kecil)
 * dengan alias atau "News Name" di tab Ref — tidak ditebak. Nama lain (mis. "Redaksi MKK", jurnalis event) = bukan kontributor.
 */
export function reporterAliases(reporter: string | null | undefined, refs: { alias: string; newsNames?: string | null }[]): { aliases: string[]; others: string[] } {
  const lookup = new Map<string, string>();
  for (const r of refs) {
    lookup.set(r.alias.toUpperCase(), r.alias.toUpperCase());
    for (const n of splitAliases(r.newsNames)) lookup.set(n, r.alias.toUpperCase());
  }
  const aliases = new Set<string>();
  const others: string[] = [];
  for (const raw of (reporter ?? "").split(/[,/&+]|\s+(?:dan|and)\s+/i).map((x) => x.trim()).filter(Boolean)) {
    const a = lookup.get(raw.toUpperCase());
    if (a) aliases.add(a);
    else others.push(raw);
  }
  return { aliases: [...aliases], others };
}

/** Satu baris tab "Master Report" (rumus tim): total artikel, konten per jurnalis, footage per orang. */
export interface MasterReportRow {
  /** nomor bulan 1–12 */
  month: number;
  total: number | null;
  content: Record<string, number>;
  footage: Record<string, number>;
}

const MONTH_NUM: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
const monthNum = (s: string) => MONTH_NUM[s.trim().slice(0, 3).toLowerCase()] ?? null;
const num = (c: Cell) => {
  const v = typeof c === "number" ? c : Number(str(c).trim().replace(",", "."));
  return Number.isFinite(v) && str(c).trim() !== "" ? v : null;
};

/** Tab "Master Report": baris "Bulan | Total Artikel | Jumlah Artikel … | Jumlah Footage …", baris kedua = alias. */
export function readMasterReport(table: RawTable): MasterReportRow[] | null {
  if (table.sheet !== undefined && !/^master\s*report$/i.test(table.sheet.trim())) return null;
  const h = table.rows.slice(0, 10).findIndex((r) => /^bulan|month$/i.test(str(r[0]).trim()) && r.some((c) => /total/i.test(str(c))));
  if (h < 0) return null;
  const top = table.rows[h].map((c) => str(c).trim());
  const aliases = (table.rows[h + 1] ?? []).map((c) => str(c).trim().toUpperCase());
  const totalCol = top.findIndex((c) => /total/i.test(c));
  const footageFrom = top.findIndex((c) => /footage/i.test(c));
  const out: MasterReportRow[] = [];
  for (const r of table.rows.slice(h + 2)) {
    const m = monthNum(str(r[0]));
    if (!m) continue;
    const row: MasterReportRow = { month: m, total: totalCol >= 0 ? num(r[totalCol]) : null, content: {}, footage: {} };
    aliases.forEach((a, i) => {
      const v = num(r[i]);
      if (!a || i <= totalCol || v == null) return;
      (footageFrom >= 0 && i >= footageFrom ? row.footage : row.content)[a] = v;
    });
    out.push(row);
  }
  return out.length ? out : null;
}

/** Selisih hitungan dashboard vs Master Report (toleransi pembulatan 0,01). Kosong = sama. */
export function compareMasterReport(month: string, master: MasterReportRow, mine: ContributorMonthCredit): string[] {
  const diff = (a: number, b: number) => Math.abs(a - b) > 0.01;
  const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString("en-ID");
  const out: string[] = [];
  if (master.total != null && diff(master.total, mine.delivered)) out.push(`total ${fmt(master.total)} vs ${fmt(mine.delivered)}`);
  for (const [a, v] of Object.entries(master.content)) if (diff(v, mine.content[a] ?? 0)) out.push(`${a} ${fmt(v)} vs ${fmt(mine.content[a] ?? 0)}`);
  for (const [a, v] of Object.entries(master.footage)) if (diff(v, mine.footage[a] ?? 0)) out.push(`${a} footage ${fmt(v)} vs ${fmt(mine.footage[a] ?? 0)}`);
  return out.length ? [`Local Contributor - Task Progress: ${month} differs from the Master Report tab (sheet vs dashboard): ${out.join(", ")}.`] : [];
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
    /** bahan carousel: foto landscape atau portrait tersedia */
    carouselReady: photo,
    /** bahan reel: video portrait tersedia */
    reelReady: a.video.state === "available",
    lastAsset: dates.sort().at(-1) ?? null,
  };
}

/** Tanggal panduan dari nama file di kolom Brief (fallback: Planned Date). */
export const rowGuideDate = (r: ContributorRow) => (r.guideFile ? panduanDate(r.guideFile) : null) ?? r.planned;

/** ID baris "<tab>#<No>" harus unik; No. dobel di sheet tidak boleh membuang baris — diberi akhiran "~2" dan dilaporkan. */
export function uniqueRowIds<T extends { id: string }>(rows: T[]): { rows: T[]; duplicates: string[] } {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  const out = rows.map((r) => {
    const n = (seen.get(r.id) ?? 0) + 1;
    seen.set(r.id, n);
    if (n === 1) return r;
    if (n === 2) duplicates.push(r.id);
    return { ...r, id: `${r.id}~${n}` };
  });
  return { rows: out, duplicates };
}
