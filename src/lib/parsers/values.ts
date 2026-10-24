// Helper konversi nilai mentah dari CSV/XLSX → angka, pecahan, detik, tanggal.

export type Cell = string | number | boolean | Date | null | undefined;

const EMPTY = new Set(["", "-", "—", "–", "n/a", "na", "null", "(–)", "(-)", "–%"]);

function cleanStr(v: Cell): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/ /g, " ").trim();
}

export function isBlank(v: Cell): boolean {
  return EMPTY.has(cleanStr(v).toLowerCase());
}

/**
 * Parse angka dengan format en (1,234.5) maupun id (1.234,5).
 * Aturan: jika ada "." dan "," → separator terakhir = desimal.
 * Hanya "," → ribuan jika polanya 1,234(,567), selain itu desimal.
 * Hanya "." → ribuan hanya jika ada >1 grup (1.234.567) atau locale "id" dan polanya ribuan.
 */
export function parseNumber(v: Cell, locale: "en" | "id" = "en"): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean" || v instanceof Date) return null;
  let s = cleanStr(v);
  if (isBlank(s)) return null;
  s = s.replace(/^rp\s*/i, "").replace(/[%\s+]/g, "").replace(/^\((.*)\)$/, "$1");
  if (s === "" || s === "-") return null;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(s) && locale === "en") s = s.replace(/,/g, "");
    else if (/^-?\d{1,3}(,\d{3}){2,}$/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  } else if (hasDot) {
    if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, "");
    else if (locale === "id" && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }
  // sufiks K / M / rb / jt (mis. "1.2K")
  const m = s.match(/^(-?\d*\.?\d+)(k|m|rb|jt)$/i);
  if (m) {
    const mult = { k: 1e3, rb: 1e3, m: 1e6, jt: 1e6 }[m[2].toLowerCase() as "k"] ?? 1;
    return parseFloat(m[1]) * mult;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Angka hitungan (views, reach, sessions, …) tidak mungkin pecahan, jadi pola
 * pengelompokan 3 digit ("1.000", "12,345") selalu dianggap pemisah ribuan.
 */
export function parseCount(v: Cell): number | null {
  if (typeof v === "string" && /^\s*[-+]?\d{1,3}([.,]\d{3})+\s*$/.test(v)) return Number(v.replace(/[^\d-]/g, ""));
  return parseNumber(v);
}

/**
 * Konversi ke pecahan 0–1.
 * mode "percent": angka tanpa "%" dianggap persen (4.43 → 0.0443).
 * mode "fraction": angka tanpa "%" dianggap pecahan (0.2069).
 * mode "auto": >1 dianggap persen.
 * String dengan "%" selalu dibagi 100.
 */
export function parseRate(v: Cell, mode: "percent" | "fraction" | "auto" = "auto", locale: "en" | "id" = "en"): number | null {
  const n = parseNumber(v, locale);
  if (n === null) return null;
  if (typeof v === "string" && v.includes("%")) return n / 100;
  if (mode === "percent") return n / 100;
  if (mode === "fraction") return n;
  return n > 1 ? n / 100 : n;
}

/** Durasi → detik. Mendukung "0:01:44", "1:44", "1m 01s", "2j 3m", angka detik. */
export function parseDuration(v: Cell): number | null {
  if (typeof v === "number") {
    // Excel time (pecahan hari) jika < 1
    return v > 0 && v < 1 ? Math.round(v * 86400) : v;
  }
  const s = cleanStr(v).toLowerCase();
  if (isBlank(s)) return null;
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) {
    const parts = s.split(":").map(Number);
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const re = /(\d+(?:[.,]\d+)?)\s*(h|j|jam|hr|m|mnt|min|menit|s|d|dtk|detik|sec)\b/g;
  let total = 0;
  let found = false;
  for (const m of s.matchAll(re)) {
    found = true;
    const n = parseFloat(m[1].replace(",", "."));
    const u = m[2];
    if (u === "h" || u === "j" || u === "jam" || u === "hr") total += n * 3600;
    else if (u.startsWith("m")) total += n * 60;
    else total += n;
  }
  if (found) return total;
  return parseNumber(s);
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januari: 1,
  feb: 2, february: 2, februari: 2, peb: 2,
  mar: 3, march: 3, maret: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7,
  aug: 8, august: 8, agu: 8, agt: 8, agus: 8, agustus: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11, nop: 11, nopember: 11,
  dec: 12, december: 12, des: 12, desember: 12,
};

export function monthFromName(name: string): number | null {
  return MONTHS[name.toLowerCase().replace(/\.$/, "")] ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");

function ymd(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Excel serial date → YYYY-MM-DD (tanpa efek timezone). */
export function excelSerialToDate(serial: number): string | null {
  if (!(serial > 20000 && serial < 80000)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export interface ParsedDate {
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
}

/**
 * Parse tanggal. `order` menentukan tafsiran 01/02/2026 yang ambigu:
 * "dmy" (default Indonesia / Google Sheets) atau "mdy" (export Meta).
 */
export function parseDate(v: Cell, order: "dmy" | "mdy" = "dmy"): ParsedDate | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const date = ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
    return date ? { date } : null;
  }
  if (typeof v === "number") {
    const date = excelSerialToDate(Math.floor(v));
    if (!date) return null;
    const frac = v - Math.floor(v);
    if (frac > 0) {
      const mins = Math.round(frac * 1440);
      return { date, time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}` };
    }
    return { date };
  }
  const s = cleanStr(v);
  if (isBlank(s)) return null;
  const timeMatch = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\s*$/i);
  let time: string | undefined;
  if (timeMatch && /\d{4}.*\d{1,2}:\d{2}/.test(s)) {
    let h = Number(timeMatch[1]);
    const ap = timeMatch[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    time = `${pad(h)}:${timeMatch[2]}`;
  }
  let m: RegExpMatchArray | null;
  // 2026-09-01, 2026/09/01, 2026-09-01T10:00
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) {
    const date = ymd(+m[1], +m[2], +m[3]);
    return date ? { date, time } : null;
  }
  // 20260901
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) {
    const date = ymd(+m[1], +m[2], +m[3]);
    return date ? { date } : null;
  }
  // 01/09/2026 atau 09/30/2026
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    const a = +m[1], b = +m[2];
    const mdy = a <= 12 && (b > 12 || order === "mdy");
    const date = mdy ? ymd(+m[3], a, b) : ymd(+m[3], b, a);
    return date ? { date, time } : null;
  }
  // "Sep 9, 2026", "September 9 2026"
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/))) {
    const mo = monthFromName(m[1]);
    const date = mo ? ymd(+m[3], mo, +m[2]) : null;
    return date ? { date, time } : null;
  }
  // "01 Sep 2026", "9 September 2026", "Selasa, 1 September 2026"
  if ((m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/))) {
    const mo = monthFromName(m[2]);
    const date = mo ? ymd(+m[3], mo, +m[1]) : null;
    return date ? { date, time } : null;
  }
  return null;
}

export function toMonth(date: string | null | undefined): string | null {
  return date && /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : null;
}

export function str(v: Cell): string {
  if (v instanceof Date) return v.toISOString();
  return cleanStr(v);
}

export function strOrNull(v: Cell): string | null {
  const s = str(v);
  return isBlank(s) ? null : s;
}

/** Normalisasi URL → path untuk pencocokan: tanpa domain, query, hash, trailing slash; lowercase. */
export function normalizePath(url: string | null | undefined): string | null {
  if (!url) return null;
  let s = url.trim();
  if (!s) return null;
  // nilai khusus GA4 ("(not set)", "(other)") bukan path — jangan diberi "/"
  if (/^\(.*\)$/.test(s)) return s.toLowerCase();
  s = s.replace(/^https?:\/\/[^/]+/i, "").replace(/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(?=\/|$)/i, "");
  s = s.split("#")[0].split("?")[0];
  try {
    s = decodeURIComponent(s);
  } catch {
    /* biarkan apa adanya */
  }
  s = s.trim().toLowerCase();
  if (!s.startsWith("/")) s = "/" + s;
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return s || "/";
}

/**
 * Konversi waktu "dinding" (YYYY-MM-DD HH:mm) dari satu zona waktu ke zona lain, sadar DST.
 * Dipakai untuk export Meta Business Suite yang mencatat waktu publish dalam Pacific Time.
 */
export function convertTimeZone(date: string, time: string, fromTz: string, toTz: string): { date: string; time: string } {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const partsIn = (ms: number, tz: string) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(ms))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  };
  // cari instant UTC yang waktu dindingnya di fromTz = wall (dua iterasi cukup untuk DST)
  let utc = wall - (partsIn(wall, fromTz) - wall);
  utc = wall - (partsIn(utc, fromTz) - utc);
  const out = new Date(partsIn(utc, toTz));
  const iso = out.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}
