import "server-only";
import { getManualMetrics } from "@/modules/shared/services/manual-metric-service";
import { getQuotas } from "@/modules/shared/services/quota-service";
import { toNewsArticleEntry } from "../../shared/mappers/news-mapper";
import { findGa4PageViews, findLatestGa4PagesImport, findNewsArticles, findNewsImports, findNewsReportViews } from "../../shared/repositories/news-repository";
import { buildNewsSummary } from "../lib/news-summary";
import type { NewsSummary } from "../types/news-summary";

/** Ringkasan News satu bulan — halaman News, Overview, laporan bulanan, rekomendasi, scorecard. */
export async function getNewsSummary(month: string): Promise<NewsSummary> {
  const [articles, ga4Pages, ga4Sync, reportViews, quotas, manual, imports] = await Promise.all([
    findNewsArticles(month),
    findGa4PageViews(month),
    findLatestGa4PagesImport(month),
    findNewsReportViews(month),
    getQuotas(month),
    getManualMetrics(month, "news"),
    findNewsImports(month),
  ]);
  return buildNewsSummary({
    month,
    articles: articles.map(toNewsArticleEntry),
    ga4Pages,
    ga4SyncedAt: ga4Sync?.createdAt ?? null,
    reportViews,
    quota: quotas.news,
    manual,
    sources: imports.map((i) => i.source),
  });
}
