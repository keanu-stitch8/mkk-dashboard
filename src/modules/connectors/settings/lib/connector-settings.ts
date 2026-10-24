import type { ConnectorInfo } from "@/lib/connectors/catalog";
import type { ConnectorStatus, EnvVar } from "@/lib/connectors/types";
import { lastMonths } from "@/lib/month";
import type { ConnectorCard, MonthLockRow } from "../types/connector-settings";

type LastSync = { month: string; status: string; startedAt: Date; finishedAt: Date | null } | null;

export function buildConnectorCard(
  info: ConnectorInfo,
  impl: { env: EnvVar[] } | undefined,
  status: ConnectorStatus | null,
  last: LastSync,
  env: { isSet: (name: string) => boolean; serviceAccount: boolean; oauthOnly: boolean },
): ConnectorCard {
  return {
    id: info.id,
    label: info.label,
    description: info.description,
    fills: info.fills,
    state: !info.available || !impl ? "soon" : status?.configured ? "ready" : "missing",
    implemented: !!impl,
    configured: !!status?.configured,
    env: (impl?.env ?? []).map((v) => ({ name: v.name, hint: v.hint, filled: env.isSet(v.name) })),
    account: status?.account ?? null,
    oauth: status?.oauth ? { connected: status.oauth.connected, account: status.oauth.account ?? null, available: !!status.oauth.available } : null,
    serviceAccountActive: env.serviceAccount && !env.oauthOnly,
    lastSync: last ? { at: last.finishedAt ?? last.startedAt, month: last.month, ok: last.status === "success" } : null,
  };
}

/** 6 bulan terakhir + semua bulan yang pernah dikunci, terbaru dulu. */
export function buildLockRows(current: string, locks: { month: string; lockedAt: Date; note: string | null }[]): MonthLockRow[] {
  return [...new Set([...lastMonths(current, 6), ...locks.map((l) => l.month)])]
    .sort()
    .reverse()
    .map((m) => {
      const lock = locks.find((l) => l.month === m);
      return { month: m, lock: lock ? { lockedAt: lock.lockedAt, note: lock.note } : null, current: m >= current };
    });
}
