// Kunci bulan final: connector metrik tidak menarik ulang bulan yang sudah dilaporkan, supaya angkanya tetap
// (metrik lifetime per post terus bertambah, reach dihitung ulang Meta). Publishing Log (sheets) tetap bisa di-sync.
import { prisma } from "../db";
import type { ConnectorId } from "./catalog";

export const LOCKABLE: ConnectorId[] = ["ga4", "gsc", "youtube", "meta"];

export const isLockable = (id: ConnectorId) => LOCKABLE.includes(id);

export async function isMonthLocked(month: string): Promise<boolean> {
  return !!(await prisma.monthLock.findUnique({ where: { month } }));
}

export async function setMonthLock(month: string, locked: boolean, note?: string): Promise<void> {
  if (locked) await prisma.monthLock.upsert({ where: { month }, create: { month, note }, update: {} });
  else await prisma.monthLock.deleteMany({ where: { month } });
}

export const lockedError = (month: string) =>
  `${month} is locked (final data for reports) — not re-synced. Unlock it in Settings → Connectors if you really need to pull it again.`;
