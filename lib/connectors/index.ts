// Registry connector + orkestrasi sync (idempotent, tercatat di SyncLog).
import { prisma } from "../db";
import { commitDataset } from "../import/commit";
import { DATASETS } from "../sources";
import { lastMonths, prevMonth } from "../month";
import { CONNECTORS, type ConnectorId } from "./catalog";
import { ConnectorError, type Connector } from "./types";
import { isLockable, isMonthLocked, lockedError } from "./lock";
import { ga4 } from "./ga4";
import { gsc } from "./gsc";
import { youtube } from "./youtube";
import { meta } from "./meta";
import { sheets } from "./sheets";

export const REGISTRY: Partial<Record<ConnectorId, Connector>> = { ga4, gsc, youtube, meta, sheets };

export function getConnector(id: string): Connector {
  const c = REGISTRY[id as ConnectorId];
  if (!c) throw new ConnectorError(`Connector "${id}" belum tersedia.`);
  return c;
}

export interface SyncResult {
  connector: ConnectorId;
  month: string;
  ok: boolean;
  rows: number;
  detail: string[];
  error?: string;
  /** dilewati karena bulan dikunci */
  locked?: boolean;
}

/** Tarik data satu bulan dari API lalu simpan (replace per bulan + sumber, sama seperti import CSV). */
export async function syncConnector(id: ConnectorId, month: string, trigger: "manual" | "script" | "cron" = "manual", force = false): Promise<SyncResult> {
  // bulan terkunci: connector metrik dilewati (tanpa log) kecuali dipaksa; Publishing Log tetap jalan
  if (isLockable(id) && !force && (await isMonthLocked(month))) return { connector: id, month, ok: false, rows: 0, detail: [], error: lockedError(month), locked: true };
  const log = await prisma.syncLog.create({ data: { connector: id, month, status: "running", trigger } });
  try {
    const connector = getConnector(id);
    const status = await connector.status();
    if (!status.configured) throw new ConnectorError(`Connector belum dikonfigurasi: ${status.missing.join(", ") || status.account || "kredensial belum lengkap"}.`);
    const datasets = await connector.fetchMonth(month);
    const detail: string[] = [];
    let rows = 0;
    for (const ds of datasets) {
      const res = await commitDataset(prisma, ds, month);
      rows += res.rows;
      detail.push(`${DATASETS[ds.key].label}: ${res.skipped ? "0 baris (tidak disimpan)" : `${res.rows.toLocaleString("id-ID")} baris`}`);
    }
    const warnings = [...new Set(datasets.flatMap((d) => d.warnings))];
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "success", rows, detail: [...detail, ...warnings.map((w) => `⚠ ${w}`)].join("\n"), finishedAt: new Date() },
    });
    return { connector: id, month, ok: true, rows, detail: [...detail, ...warnings.map((w) => `⚠ ${w}`)] };
  } catch (e) {
    const error = e instanceof ConnectorError ? e.message : `Terjadi kesalahan: ${(e as Error)?.message ?? e}`;
    const raw = e instanceof ConnectorError ? e.raw : String((e as Error)?.stack ?? e);
    await prisma.syncLog.update({ where: { id: log.id }, data: { status: "error", error, rawError: raw?.slice(0, 4000), finishedAt: new Date() } });
    return { connector: id, month, ok: false, rows: 0, detail: [], error };
  }
}

/** Connector yang sudah dibuat & terkonfigurasi. */
export async function configuredConnectors(): Promise<ConnectorId[]> {
  const out: ConnectorId[] = [];
  for (const info of CONNECTORS) {
    const c = REGISTRY[info.id];
    if (c && (await c.status()).configured) out.push(info.id);
  }
  return out;
}

/** Sync beberapa connector × beberapa bulan secara berurutan (aman untuk rate limit). */
export async function syncMany(ids: ConnectorId[], months: string[], trigger: "manual" | "script" | "cron" = "manual", force = false): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const month of months) for (const id of ids) results.push(await syncConnector(id, month, trigger, force));
  return results;
}

/** Bulan untuk backfill: n bulan terakhir sampai bulan ini. */
export const backfillMonths = (n: number, now = new Date()) => lastMonths(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, n);
export const lastFullMonth = (now = new Date()) => prevMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
