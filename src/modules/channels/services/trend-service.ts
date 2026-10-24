import "server-only";
import { trendMonths } from "@/modules/shared/lib/trend-months";
import { buildTrendPoint } from "../lib/trend";
import type { TrendPoint } from "../types/trend";
import { getMonthBundle } from "./month-bundle-service";

/** Tren lintas channel n bulan terakhir (sejak launching). */
export async function getTrend(month: string, n = 6): Promise<TrendPoint[]> {
  const bundles = await Promise.all(trendMonths(month, n).map((m) => getMonthBundle(m)));
  return bundles.map(buildTrendPoint);
}
