import { fmtNum, fmtPct } from "@/lib/format";
import { FORMAT_LABEL } from "@/lib/sources";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import type { SocialSummary } from "../types/social-summary";

/** Kuota Social: satu angka untuk semua format; Publishing Log = sumber resmi. */
export function socialQuota(s: SocialSummary): QuotaSummary {
  const q = s.quotaProgress[0];
  const notInLog = s.postsNotInLog.length;
  const notes = [
    s.hasReview ? `Published only: ${fmtNum(q.published)} / ${fmtNum(q.quota.value)} (${fmtPct(q.publishedRate)})` : "The Task Progress tracker hasn't been synced this month — in review counted as 0",
    s.countSource === "log"
      ? notInLog
        ? `${notInLog} MKK account posts aren't in the Publishing Log (not counted toward the quota)`
        : null
      : "Stories aren't in the Meta export — import the Publishing Log for official numbers",
  ].filter(Boolean);
  return {
    channel: "social",
    label: "Social",
    unit: "posts",
    published: q.published,
    // yang sudah diserahkan = publish (Publishing Log) + in review (Task Progress, snapshot akhir bulan)
    achieved: q.count,
    achievedLabel: "Delivered",
    target: q.quota.value,
    rate: q.available ? q.rate : null,
    segments: [
      { label: "Published", count: q.published, color: "var(--chart-1)" },
      { label: "In review", count: q.inReview, color: "var(--chart-2)" },
    ],
    available: q.available,
    breakdown: s.publishedByFormat.map((f) => ({ label: FORMAT_LABEL[f.format] ?? f.format, count: f.count, target: null, rate: null })),
    note: notes.join(" · ") || undefined,
    source: `${s.countSource === "log" ? "Published from the Publishing Log (1 row = 1 post)" : "Published from the Meta export"} · in review = submitted this month, not yet published by month end (Task Progress)`,
  };
}
