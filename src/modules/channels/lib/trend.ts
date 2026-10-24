import { newsTrendFields } from "@/modules/news/overview/lib/news-trend";
import { socialTrendFields } from "@/modules/social/overview/lib/social-trend";
import { websiteTrendFields } from "@/modules/website/overview/lib/website-trend";
import { youtubeTrendFields } from "@/modules/youtube/overview/lib/youtube-trend";
import type { MonthBundle } from "../types/month-bundle";
import type { TrendPoint } from "../types/trend";

export function buildTrendPoint(b: MonthBundle): TrendPoint {
  return { month: b.month, ...websiteTrendFields(b.website), ...newsTrendFields(b.news), ...youtubeTrendFields(b.youtube), ...socialTrendFields(b.social) };
}
