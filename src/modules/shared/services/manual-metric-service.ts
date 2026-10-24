import "server-only";
import type { Channel } from "@/lib/parsers/types";
import { toMetricMap } from "../mappers/metric-mapper";
import { findManualMetrics } from "../repositories/manual-metric-repository";

/** Angka yang diisi manual di halaman Import; menimpa angka hasil import/connector. */
export async function getManualMetrics(month: string, channel: Channel): Promise<Record<string, number>> {
  return toMetricMap(await findManualMetrics(month, channel));
}
