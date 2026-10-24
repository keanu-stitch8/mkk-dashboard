import { platformLabels, socialFormatLabel } from "@/modules/shared/lib/taxonomy";
import type { SocialLogLink } from "../../overview/types/social-summary";
import type { SocialLogRow, SocialLogs } from "../types/social-log";

/** Kotak thumbnail Instagram 4:5 (rasio feed); reels 9:16 dipotong di tengah. */
const IG_RATIO = "4:5" as const;

/** Publishing log + konten in review dari Task Progress ("format · judul", tanpa tanggal tayang) → baris tabel. */
export function buildSocialLogs(logs: SocialLogLink[], inReviewItems: string[], igThumb: Map<string, string>): SocialLogs {
  const rows: SocialLogRow[] = logs.map((l) => ({
    date: l.date,
    title: l.title ?? "(untitled)",
    url: l.link,
    status: l.status,
    fields: { format: socialFormatLabel(l.format), category: l.category, platform: platformLabels(l.platform).join(", ") || null, designer: l.designer },
    thumb: l.igMediaId ? (igThumb.get(l.igMediaId) ?? null) : null,
    thumbRatio: IG_RATIO,
  }));
  for (const label of inReviewItems) {
    const [format, ...title] = label.split(" · ");
    rows.push({ date: null, title: title.join(" · ") || "(untitled)", url: null, status: "review", fields: { format: socialFormatLabel(format), category: null, platform: null, designer: null }, thumbRatio: IG_RATIO });
  }
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  return { rows, published: count("publish"), inReview: count("review"), withLink: rows.filter((r) => r.url).length };
}
