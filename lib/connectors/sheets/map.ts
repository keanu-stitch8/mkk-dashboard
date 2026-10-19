// Pencocokan file Publishing Log bulanan di Google Drive (murni, tanpa I/O — dites dengan daftar nama file).
// 1 bulan = 1 file per log. Nama mengikuti kebiasaan tim, mis.:
//   "MKK - News Content Logs - September 2026", "Socmed Content Logs - September 2026",
//   "MKK Youtube Monthly Performance Report - September 2026" (Publishing Log YouTube ada di report).
import type { DatasetKey, SourceGroup } from "../../parsers/types";

export type LogKind = "news" | "social" | "youtube";

export const LOG_FILES: Record<LogKind, { label: string; pattern: RegExp; group: SourceGroup; key: DatasetKey }> = {
  news: { label: "News Content Logs", pattern: /\bnews content logs?\b/i, group: "news", key: "news_log" },
  social: { label: "Socmed Content Logs", pattern: /\b(socmed|social media|sosmed) content logs?\b/i, group: "social_log", key: "social_log" },
  youtube: { label: "Youtube Monthly Performance Report", pattern: /\byoutube monthly performance report\b/i, group: "youtube", key: "yt_log" },
};

const MONTHS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTHS_ID = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "may|mei", "jun", "jul", "aug|agu|agt", "sep|sept", "oct|okt", "nov", "dec|des"];

/** Nama file menyebut bulan ini? ("September 2026", "Sept 2026", "Oktober 2026", "2026-09", "202609") */
export function nameHasMonth(name: string, month: string): boolean {
  const [y, m] = month.split("-");
  const i = Number(m) - 1;
  const words = [...new Set([MONTHS_EN[i], MONTHS_ID[i], ...MONTHS_SHORT[i].split("|")])].join("|");
  const s = name.toLowerCase();
  return new RegExp(`\\b(${words})\\.?\\s*[-/,]?\\s*${y}\\b`).test(s) || new RegExp(`\\b${y}[-_. ]?${m}\\b`).test(s);
}

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

/** File log untuk bulan ini. Jika lebih dari satu (mis. salinan), yang terakhir diubah dipakai. */
export function pickLogFile(files: DriveFile[], kind: LogKind, month: string): { file: DriveFile | null; others: DriveFile[] } {
  const matches = files
    .filter((f) => LOG_FILES[kind].pattern.test(f.name) && nameHasMonth(f.name, month))
    .sort((a, b) => (a.name.toLowerCase().startsWith("copy of") ? 1 : 0) - (b.name.toLowerCase().startsWith("copy of") ? 1 : 0) || (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
  return { file: matches[0] ?? null, others: matches.slice(1) };
}
