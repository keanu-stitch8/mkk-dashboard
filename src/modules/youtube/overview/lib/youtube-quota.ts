import { fmtNum, fmtPct } from "@/modules/shared/lib/format";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import type { YoutubeSummary } from "../types/youtube-summary";

/** Kuota YouTube dalam bentuk yang sama dengan News & Social (QuotaHero, Overview, Scorecard). */
export function youtubeQuota(y: YoutubeSummary): QuotaSummary {
  return {
    channel: "youtube",
    label: "YouTube",
    unit: "videos",
    published: y.published,
    // yang sudah diserahkan = publish + Review/Approved di Gantt per akhir bulan
    achieved: y.delivered,
    achievedLabel: "Delivered",
    target: y.quota.value,
    rate: y.hasData ? y.deliveredRate : null,
    segments: [
      { label: "Published", count: y.published, color: "var(--chart-1)" },
      { label: "In review", count: y.inReview, color: "var(--chart-2)" },
    ],
    available: y.hasData,
    breakdown: [],
    note: y.hasData
      ? y.hasReview
        ? `Published only: ${fmtNum(y.published)} / ${fmtNum(y.quota.value)} (${fmtPct(y.achievement)})`
        : "The Calendar Timeline Gantt hasn't been synced this month — in review counted as 0"
      : undefined,
    source: `${y.logs.length ? "Published from the Youtube Calendar Timeline (Summary)" : "Published from video publish dates"} · in review = Review/Approved in the Gantt at month end`,
  };
}
