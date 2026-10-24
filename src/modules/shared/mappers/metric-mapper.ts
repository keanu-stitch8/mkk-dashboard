/**
 * Baris metrik (Metric / ManualMetric) → peta key → nilai. Key ganda: baris pertama yang dipakai,
 * sama seperti `rows.find((r) => r.key === k)`.
 */
export function toMetricMap(rows: { key: string; value: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) if (!(r.key in out)) out[r.key] = r.value;
  return out;
}
