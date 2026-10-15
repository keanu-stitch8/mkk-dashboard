import { prisma } from "../db";
import { QUOTA_DEFAULTS } from "../sources";

export interface QuotaValue {
  key: string;
  label: string;
  value: number;
  /** true jika nilai khusus bulan ini (bukan default) */
  override: boolean;
}

export async function getQuotas(month: string): Promise<Record<string, QuotaValue>> {
  const rows = await prisma.quota.findMany({ where: { month: { in: [month, "default"] } } });
  const out: Record<string, QuotaValue> = {};
  for (const q of QUOTA_DEFAULTS) {
    const own = rows.find((r) => r.month === month && r.key === q.key);
    const def = rows.find((r) => r.month === "default" && r.key === q.key);
    out[q.key] = { key: q.key, label: q.label, value: own?.value ?? def?.value ?? q.value, override: !!own };
  }
  return out;
}
