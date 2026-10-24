import "server-only";
import { findImportMonths, findManualMetricMonths } from "../repositories/month-repository";

/** Bulan yang punya import atau input manual, urut naik. */
export async function getMonthsWithData(): Promise<string[]> {
  const [imports, manual] = await Promise.all([findImportMonths(), findManualMetricMonths()]);
  return [...new Set([...imports, ...manual].map((r) => r.month))].sort();
}
