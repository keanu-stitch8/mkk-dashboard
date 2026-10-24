import { CONNECTORS } from "@/lib/connectors/catalog";
import { groupSessions, paginate } from "@/modules/shared/lib/history";
import type { SyncHistory, SyncRun, SyncTrigger } from "../types/sync-history";

export const SYNC_HISTORY_PER_PAGE = 10;
/** syncMany menjalankan connector berurutan; log berikutnya mulai begitu yang sebelumnya selesai */
const SESSION_GAP_MS = 60_000;

export const TRIGGERS: Record<SyncTrigger, { label: string; hint: string }> = {
  cron: { label: "Cron", hint: "automatic schedule" },
  manual: { label: "Manual", hint: "Sync button in the dashboard" },
  script: { label: "Script", hint: "npm run sync" },
};

export const isTrigger = (t: unknown): t is SyncTrigger => typeof t === "string" && t in TRIGGERS;

export const isConnector = (c: unknown): c is string => typeof c === "string" && CONNECTORS.some((x) => x.id === c);

/**
 * Log sync (urut terbaru dulu, sudah disaring trigger) → sesi per halaman. Sesi dibentuk dari semua connector dulu,
 * baru disaring per connector: kalau disaring duluan, satu sesi backfill multi-bulan bisa pecah karena jeda antar-run
 * connector yang sama melebihi SESSION_GAP_MS.
 */
export function buildSyncHistory(logs: SyncRun[], filter: { trigger?: SyncTrigger; connector?: string }, page: number): SyncHistory {
  const { connector } = filter;
  const sessions = groupSessions(logs, { start: (l) => l.startedAt, end: (l) => l.finishedAt, gapMs: SESSION_GAP_MS, sameSession: (a, b) => a.trigger === b.trigger })
    .map((s) => {
      if (!connector) return s;
      const rows = s.rows.filter((l) => l.connector === connector);
      const start = new Date(Math.min(...rows.map((l) => l.startedAt.getTime())));
      const end = new Date(Math.max(...rows.map((l) => (l.finishedAt ?? l.startedAt).getTime())));
      return { rows, start, end };
    })
    .filter((s) => s.rows.length > 0);
  const pg = paginate(sessions, page, SYNC_HISTORY_PER_PAGE);
  return {
    trigger: filter.trigger,
    connector,
    total: sessions.length,
    page: pg.page,
    pages: pg.pages,
    sessions: pg.items.map((s) => ({
      ...s,
      ok: s.rows.filter((l) => l.status === "success").length,
      failed: s.rows.filter((l) => l.status === "error").length,
      totalRows: s.rows.reduce((n, l) => n + l.rows, 0),
      months: [...new Set(s.rows.map((l) => l.month))].sort().reverse(),
    })),
  };
}
