import "server-only";
import { toMetricMap } from "@/modules/shared/mappers/metric-mapper";
import { getManualMetrics } from "@/modules/shared/services/manual-metric-service";
import { toGa4ChannelRow, toGa4LandingRow, toGa4PageRow, toGscDailyPoint, toGscPageRow, toGscQueryRow } from "../../shared/mappers/website-mapper";
import {
  findGa4Channels,
  findGa4Pages,
  findGscDaily,
  findGscPages,
  findGscQueries,
  findTopGa4Landings,
  findWebsiteBreakdowns,
  findWebsiteImports,
  findWebsiteMetrics,
} from "../../shared/repositories/website-repository";
import { buildWebsiteSummary } from "../lib/website-summary";
import type { WebsiteSummary } from "../types/website-summary";

/** Ringkasan Website satu bulan — halaman Website, Overview, laporan bulanan, rekomendasi. */
export async function getWebsiteSummary(month: string): Promise<WebsiteSummary> {
  const [imports, channels, pages, landings, metrics, breakdowns, gscDaily, gscQueries, gscPages, manual] = await Promise.all([
    findWebsiteImports(month),
    findGa4Channels(month),
    findGa4Pages(month),
    findTopGa4Landings(month),
    findWebsiteMetrics(month),
    findWebsiteBreakdowns(month),
    findGscDaily(month),
    findGscQueries(month),
    findGscPages(month),
    getManualMetrics(month, "website"),
  ]);
  return buildWebsiteSummary({
    month,
    sources: imports.map((i) => i.source),
    channels: channels.map(toGa4ChannelRow),
    pages: pages.map(toGa4PageRow),
    landings: landings.map(toGa4LandingRow),
    metrics: toMetricMap(metrics),
    breakdowns,
    gscDaily: gscDaily.map(toGscDailyPoint),
    gscQueries: gscQueries.map(toGscQueryRow),
    gscPages: gscPages.map(toGscPageRow),
    manual,
  });
}
