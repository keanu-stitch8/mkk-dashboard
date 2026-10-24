import "server-only";
import type { Channel } from "@/lib/parsers/types";
import { toMetricMap } from "../mappers/metric-mapper";
import { MANUAL_FIELDS } from "@/lib/sources";
import { planOverrides } from "../lib/overrides";
import { deleteManualMetric, findManualMetrics, upsertManualMetric } from "../repositories/manual-metric-repository";

/** Angka yang diisi manual di halaman Import; menimpa angka hasil import/connector. */
export async function getManualMetrics(month: string, channel: Channel): Promise<Record<string, number>> {
  return toMetricMap(await findManualMetrics(month, channel));
}

/** Simpan input manual satu channel; null = hapus override (kembali ke angka import/connector). */
export async function saveManualMetrics(month: string, channel: Channel, values: Record<string, number | null>): Promise<void> {
  const { set, clear } = planOverrides(values, new Set(MANUAL_FIELDS[channel].map((f) => f.key)));
  for (const key of clear) await deleteManualMetric(month, channel, key);
  for (const [key, value] of set) await upsertManualMetric(month, channel, key, value);
}
