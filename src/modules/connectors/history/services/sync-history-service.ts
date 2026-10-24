import "server-only";
import { buildSyncHistory, isConnector, isTrigger } from "../lib/sync-history";
import { findSyncLogs } from "../repositories/sync-log-repository";
import type { SyncHistory } from "../types/sync-history";

/** Filter dari query string yang tidak dikenal diabaikan (= semua). */
export async function getSyncHistory(params: { trigger?: string; connector?: string; page: number }): Promise<SyncHistory> {
  const trigger = isTrigger(params.trigger) ? params.trigger : undefined;
  const connector = isConnector(params.connector) ? params.connector : undefined;
  return buildSyncHistory(await findSyncLogs(trigger), { trigger, connector }, params.page);
}
