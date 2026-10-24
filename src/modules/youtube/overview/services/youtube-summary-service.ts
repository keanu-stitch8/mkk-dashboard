import "server-only";
import { getQuotas } from "@/modules/shared/services/quota-service";
import { toMetricMap } from "@/modules/shared/mappers/metric-mapper";
import { getManualMetrics } from "@/modules/shared/services/manual-metric-service";
import { toYoutubeDailyPoint, toYoutubeLogEntry, toYoutubeVideoMetrics } from "../../shared/mappers/youtube-mapper";
import {
  findYoutubeDaily,
  findYoutubeImports,
  findYoutubeLogs,
  findYoutubeMetrics,
  findYoutubeReviewItems,
  findYoutubeVideos,
} from "../../shared/repositories/youtube-repository";
import { buildYoutubeSummary } from "../lib/youtube-summary";
import type { YoutubeSummary } from "../types/youtube-summary";

/** Ringkasan YouTube satu bulan — dipakai halaman YouTube, Overview, laporan bulanan, rekomendasi, scorecard. */
export async function getYoutubeSummary(month: string): Promise<YoutubeSummary> {
  const [videos, metrics, daily, logs, imports, reviewItems, quotas, manual] = await Promise.all([
    findYoutubeVideos(month),
    findYoutubeMetrics(month),
    findYoutubeDaily(month),
    findYoutubeLogs(month),
    findYoutubeImports(month),
    findYoutubeReviewItems(month),
    getQuotas(month),
    getManualMetrics(month, "youtube"),
  ]);
  return buildYoutubeSummary({
    month,
    videos: videos.map(toYoutubeVideoMetrics),
    daily: daily.map(toYoutubeDailyPoint),
    logs: logs.map(toYoutubeLogEntry),
    metrics: toMetricMap(metrics),
    manual,
    sources: imports.map((i) => i.source),
    reviewItems: reviewItems.map((b) => b.label),
    quota: quotas.youtube,
  });
}
