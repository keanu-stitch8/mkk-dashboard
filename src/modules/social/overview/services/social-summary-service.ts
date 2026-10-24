import "server-only";
import { addMonths } from "@/modules/shared/lib/month";
import { toMetricMap } from "@/modules/shared/mappers/metric-mapper";
import { getManualMetrics } from "@/modules/shared/services/manual-metric-service";
import { getQuotas } from "@/modules/shared/services/quota-service";
import { toSocialLogEntry, toSocialPostEntry } from "../../shared/mappers/social-mapper";
import {
  findActiveSocialPosts,
  findFirstApiStory,
  findFirstIgSnapshotDate,
  findIgAccountByType,
  findIgAccountMetrics,
  findIgSnapshotViews,
  findIgStoryDates,
  findSocialImports,
  findSocialLogs,
  findSocialReviewImport,
  findSocialReviewItems,
} from "../../shared/repositories/social-repository";
import { buildSocialSummary } from "../lib/social-summary";
import type { SocialSummary } from "../types/social-summary";

/**
 * Snapshot IgMediaSnapshot pertama setelah bulan selesai (maks. 7 hari) → views per media s/d akhir bulan.
 * Untuk post yang dipublish bulan itu, nilai ini = views selama bulan itu dan tidak berubah saat sync ulang.
 */
async function monthEndSnapshot(month: string) {
  const start = `${addMonths(month, 1)}-01`;
  const limit = new Date(Date.parse(`${start}T00:00:00Z`) + 7 * 86400_000).toISOString().slice(0, 10);
  const first = await findFirstIgSnapshotDate(start, limit);
  if (!first) return null;
  const rows = await findIgSnapshotViews(first.date);
  return { date: first.date, views: new Map(rows.map((r) => [r.mediaId, r.views])) };
}

/** Ringkasan Social satu bulan — halaman Social, Overview, laporan bulanan, rekomendasi, scorecard. */
export async function getSocialSummary(month: string): Promise<SocialSummary> {
  const [allPosts, logs, quotas, manual, imports, accountMetrics, reviewImport, reviewItems, monthSnapshot, igTypeRows, storyRows, firstApiStory] = await Promise.all([
    findActiveSocialPosts(month),
    findSocialLogs(month),
    getQuotas(month),
    getManualMetrics(month, "social"),
    findSocialImports(month),
    findIgAccountMetrics(month),
    findSocialReviewImport(month),
    findSocialReviewItems(month),
    monthEndSnapshot(month),
    findIgAccountByType(month),
    findIgStoryDates(month),
    findFirstApiStory(),
  ]);
  const account = toMetricMap(accountMetrics.map((m) => ({ key: m.key.replace(/^ig_account_/, ""), value: m.value })));
  return buildSocialSummary({
    month,
    allPosts: allPosts.map(toSocialPostEntry),
    logs: logs.map(toSocialLogEntry),
    quota: quotas.social,
    manual,
    imports,
    account,
    hasReviewImport: !!reviewImport,
    reviewItems: reviewItems.map((b) => b.label),
    monthSnapshot,
    igTypeRows,
    storyRows,
    firstApiStoryDate: firstApiStory?.date ?? null,
  });
}
