import { groupSessions, paginate } from "@/modules/shared/lib/history";
import type { ImportEntry, ImportHistory } from "../types/import-history";

export const IMPORT_HISTORY_PER_PAGE = 10;
/** dataset dari satu sync / satu sesi upload ditulis beruntun; jeda > 5 menit = sesi baru */
const SESSION_GAP_MS = 5 * 60_000;

/** Asal dataset dari nama file yang disimpan saat commit (API connector, Sheets connector, atau file upload). */
export function importOrigin(fileName: string) {
  if (fileName.startsWith("API ")) return "API sync";
  if (fileName.startsWith("Google Sheets · ")) return "Google Sheets";
  return "File upload";
}

/** Dataset (urut terbaru dulu) → sesi per halaman. */
export function buildImportHistory(imports: ImportEntry[], page: number): ImportHistory {
  const sessions = groupSessions(imports, { start: (i) => i.createdAt, gapMs: SESSION_GAP_MS });
  const pg = paginate(sessions, page, IMPORT_HISTORY_PER_PAGE);
  return {
    total: imports.length,
    page: pg.page,
    pages: pg.pages,
    sessions: pg.items.map((s) => ({
      start: s.start,
      rows: s.rows,
      totalRows: s.rows.reduce((n, i) => n + i.rowCount, 0),
      origins: [...new Set(s.rows.map((i) => importOrigin(i.fileName)))],
      months: [...new Set(s.rows.map((i) => i.month))].sort().reverse(),
    })),
  };
}
