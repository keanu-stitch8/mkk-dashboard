import { newsQuota } from "@/modules/news/overview/lib/news-quota";
import type { QuotaSummary } from "@/modules/shared/types/quota-summary";
import { socialQuota } from "@/modules/social/overview/lib/social-quota";
import { youtubeQuota } from "@/modules/youtube/overview/lib/youtube-quota";
import type { MonthBundle } from "../types/month-bundle";

/** Kuota tercapai per channel konten, dalam bentuk yang sama untuk semua halaman. */
export function contentQuota(b: MonthBundle, channel: QuotaSummary["channel"]): QuotaSummary {
  if (channel === "news") return newsQuota(b.news);
  if (channel === "youtube") return youtubeQuota(b.youtube);
  return socialQuota(b.social);
}
