import { categoryLabel } from "@/modules/shared/lib/taxonomy";
import { groupStats } from "@/modules/shared/lib/group-stats";
import { safeDiv, sum } from "@/modules/shared/lib/math";
import type { YoutubeSummary, YoutubeSummaryInput } from "../types/youtube-summary";


/**
 * Ringkasan YouTube satu bulan. Urutan sumber tiap angka: input manual → total import/connector →
 * jumlah per video (→ jumlah harian untuk watch time).
 */
export function buildYoutubeSummary({ month, videos, daily, logs, metrics, manual, sources, reviewItems, quota }: YoutubeSummaryInput): YoutubeSummary {
  const metric = (k: string) => manual[k] ?? metrics[k] ?? null;
  const views = metric("views") ?? (videos.length ? sum(videos.map((v) => v.views)) : null);
  const watchHours = metric("watchHours") ?? (videos.length ? sum(videos.map((v) => v.watchHours)) : daily.length ? sum(daily.map((d) => d.watchHours)) : null);
  const impressions = metric("impressions") ?? (videos.length ? sum(videos.map((v) => v.impressions)) : null);
  const ctr = metric("ctr") ?? (videos.length ? safeDiv(sum(videos.map((v) => (v.ctr ?? 0) * (v.impressions ?? 0))), impressions) : null);
  const subsGained = metric("subsGained") ?? (videos.length ? sum(videos.map((v) => v.subsGained)) : null);
  const subsLost = metric("subsLost") ?? (videos.some((v) => v.subsLost != null) ? sum(videos.map((v) => v.subsLost)) : null);
  const avgViewDurationSec = metric("avgViewDurationSec") ?? (watchHours != null && views ? (watchHours * 3600) / views : null);

  const logByVideo = new Map(logs.filter((l) => l.videoId).map((l) => [l.videoId!, l]));
  const logByTitle = new Map(logs.map((l) => [l.title.trim().toLowerCase(), l]));
  const enriched = videos.map((v) => {
    const log = logByVideo.get(v.videoId) ?? logByTitle.get(v.title.trim().toLowerCase());
    return { ...v, category: log?.category ?? null, format: log?.format ?? null, shareOfViews: safeDiv(v.views, views) };
  });
  const publishedLogs = logs.filter((l) => l.status === "publish");
  const published = manual.published ?? (logs.length ? publishedLogs.length : videos.filter((v) => v.publishedDate?.startsWith(month)).length);
  const hasReview = manual.inReview != null || sources.includes("yt_review");
  const inReview = manual.inReview ?? reviewItems.length;
  const delivered = published + inReview;

  return {
    month,
    hasData: sources.length > 0 || Object.keys(manual).length > 0,
    sources,
    views,
    watchHours,
    impressions,
    ctr,
    subsGained,
    subsLost,
    subsNet: subsGained == null ? null : subsGained - (subsLost ?? 0),
    hasSubsLost: subsLost != null,
    avgViewDurationSec,
    uniqueViewers: metric("uniqueViewers"),
    viewsPerVideo: views == null || !videos.length ? null : views / videos.length,
    published,
    inReview,
    inReviewItems: reviewItems,
    hasReview,
    delivered,
    deliveredRate: safeDiv(delivered, quota.value),
    quota,
    achievement: safeDiv(published, quota.value),
    videos: enriched,
    topVideos: enriched.slice(0, 10),
    lowCtrVideos: enriched.filter((v) => v.ctr != null && v.ctr < 0.04 && (v.impressions ?? 0) >= 100),
    byCategory: groupStats(enriched.filter((v) => categoryLabel(v.category)), (v) => [categoryLabel(v.category)!], (v) => v.views),
    daily,
    logs,
  };
}
