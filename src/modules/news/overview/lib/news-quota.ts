import { fmtNum, fmtPct } from "@/lib/format";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import type { NewsSummary } from "../types/news-summary";

export function newsQuota(n: NewsSummary): QuotaSummary {
  return {
    channel: "news",
    label: "News",
    unit: "articles",
    published: n.published,
    // yang sudah diserahkan = publish + review
    achieved: n.delivered,
    achievedLabel: "Delivered",
    target: n.quota.value,
    rate: n.hasData ? n.achievement : null,
    segments: [
      { label: "Published", count: n.published, color: "var(--chart-1)" },
      { label: "In review", count: n.inReview, color: "var(--chart-2)" },
    ],
    available: n.hasData,
    breakdown: [],
    note: n.hasData ? `Published only: ${fmtNum(n.published)} / ${fmtNum(n.quota.value)} (${fmtPct(n.publishedRate)})` : undefined,
    source: "From News Content Logs (status Publish + Review)",
  };
}
