import { QUOTA_DEFAULTS } from "@/lib/sources";
import type { QuotaValue } from "@/modules/shared/types/quota";
import type { QuotaFormRow } from "../types/import-page";

/** Input manual per channel → { channel: { key: value } }. */
export function groupManualValues(rows: { channel: string; key: string; value: number }[]): Record<string, Record<string, number>> {
  const manual: Record<string, Record<string, number>> = {};
  for (const r of rows) (manual[r.channel] ??= {})[r.key] = r.value;
  return manual;
}

export function buildQuotaRows(quotas: Record<string, QuotaValue>, defaults: { key: string; value: number }[]): QuotaFormRow[] {
  return QUOTA_DEFAULTS.map((q) => ({
    key: q.key,
    label: q.label,
    defaultValue: defaults.find((d) => d.key === q.key)?.value ?? q.value,
    monthValue: quotas[q.key].override ? quotas[q.key].value : null,
  }));
}
