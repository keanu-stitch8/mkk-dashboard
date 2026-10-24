import "server-only";
import { QUOTA_DEFAULTS } from "@/lib/sources";
import { planOverrides } from "../lib/overrides";
import { resolveQuotas } from "../lib/quota";
import { deleteQuota, findQuotaRows, upsertQuota } from "../repositories/quota-repository";
import type { QuotaValue } from "../types/quota";

export async function getQuotas(month: string): Promise<Record<string, QuotaValue>> {
  return resolveQuotas(month, await findQuotaRows(month));
}

/** Simpan kuota ("default" atau YYYY-MM); kosong / negatif = hapus override bulan (default tidak pernah dihapus). */
export async function saveQuotas(month: string, values: Record<string, number | null>): Promise<void> {
  const { set, clear } = planOverrides(values, new Set(QUOTA_DEFAULTS.map((q) => q.key)), (v) => v >= 0);
  if (month !== "default") for (const key of clear) await deleteQuota(month, key);
  for (const [key, value] of set) await upsertQuota(month, key, value);
}
