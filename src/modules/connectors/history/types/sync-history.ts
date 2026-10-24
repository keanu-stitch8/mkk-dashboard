export type SyncTrigger = "cron" | "manual" | "script";

export interface SyncRun {
  id: string;
  connector: string;
  month: string;
  /** success | error | running */
  status: string;
  rows: number;
  detail: string | null;
  error: string | null;
  trigger: string;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface SyncSession {
  start: Date;
  end: Date;
  rows: SyncRun[];
  ok: number;
  failed: number;
  totalRows: number;
  /** bulan data dalam sesi, terbaru dulu */
  months: string[];
}

export interface SyncHistory {
  trigger: SyncTrigger | undefined;
  connector: string | undefined;
  /** jumlah sesi setelah filter (semua halaman) */
  total: number;
  sessions: SyncSession[];
  page: number;
  pages: number;
}
