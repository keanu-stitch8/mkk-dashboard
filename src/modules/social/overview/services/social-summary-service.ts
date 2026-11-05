import "server-only";
import { toMetricMap } from "@/modules/shared/mappers/metric-mapper";
import { getManualMetrics } from "@/modules/shared/services/manual-metric-service";
import { getQuotas } from "@/modules/shared/services/quota-service";
import { toSocialLogEntry, toSocialPostEntry } from "../../shared/mappers/social-mapper";
import {
  findActiveSocialPosts,
  findFirstApiStory,
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
import { getCsvPostFollows } from "../../shared/services/csv-follows-service";
import { withCsvFollows } from "../../shared/lib/csv-follows";
import { socialPostSnapshotDate } from "../../shared/lib/post-snapshot-date";
import { dateIn, WIB } from "@/modules/shared/lib/tz";

/** Use the exact lock cut-off date, without an arbitrary-date fallback. */
async function postViewsSnapshot(month: string) {
  const date = socialPostSnapshotDate(month);
  const rows = await findIgSnapshotViews(date);
  return rows.length ? { date, views: new Map(rows.map((r) => [r.mediaId, r.views])) } : null;
}

/** Ringkasan Social satu bulan — halaman Social, Overview, laporan bulanan, rekomendasi, scorecard. */
export async function getSocialSummary(month: string): Promise<SocialSummary> {
  const [allPosts, logs, quotas, manual, imports, accountMetrics, reviewImport, reviewItems, monthSnapshot, igTypeRows, storyRows, firstApiStory, csvFollows] = await Promise.all([
    findActiveSocialPosts(month),
    findSocialLogs(month),
    getQuotas(month),
    getManualMetrics(month, "social"),
    findSocialImports(month),
    findIgAccountMetrics(month),
    findSocialReviewImport(month),
    findSocialReviewItems(month),
    postViewsSnapshot(month),
    findIgAccountByType(month),
    findIgStoryDates(month),
    findFirstApiStory(),
    getCsvPostFollows([month]),
  ]);
  const account = toMetricMap(accountMetrics.map((m) => ({ key: m.key.replace(/^ig_account_/, ""), value: m.value })));
  const snapshotDate = socialPostSnapshotDate(month);
  const importedOn = imports.find((row) => row.source === "meta_instagram")?.createdAt;
  // Prefer the stored cut-off sync to an earlier daily snapshot taken on that same date.
  const reportingSnapshot = importedOn && dateIn(importedOn, WIB) === snapshotDate && allPosts.length
    ? { date: snapshotDate, views: new Map([...(monthSnapshot?.views ?? []), ...allPosts.filter((post) => post.platform === "instagram").map((post) => [post.postId, post.views] as const)]) }
    : monthSnapshot;
  return buildSocialSummary({
    month,
    allPosts: withCsvFollows(allPosts.map(toSocialPostEntry), csvFollows),
    logs: logs.map(toSocialLogEntry),
    quota: quotas.social,
    manual,
    imports,
    account,
    hasReviewImport: !!reviewImport,
    reviewItems: reviewItems.map((b) => b.label),
    monthSnapshot: reportingSnapshot,
    igTypeRows,
    storyRows,
    firstApiStoryDate: firstApiStory?.date ?? null,
  });
}
