import { QUOTA_DEFAULTS } from "@/lib/sources";
import type { QuotaValue } from "../types/quota";

/** Kuota per key: nilai khusus bulan ini → default tersimpan (month "default") → default bawaan (lib/sources.ts). */
export function resolveQuotas(month: string, rows: { month: string; key: string; value: number }[]): Record<string, QuotaValue> {
  const out: Record<string, QuotaValue> = {};
  for (const q of QUOTA_DEFAULTS) {
    const own = rows.find((r) => r.month === month && r.key === q.key);
    const def = rows.find((r) => r.month === "default" && r.key === q.key);
    out[q.key] = { key: q.key, label: q.label, value: own?.value ?? def?.value ?? q.value, override: !!own };
  }
  return out;
}
