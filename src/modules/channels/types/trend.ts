import type { NewsTrendFields } from "@/modules/news/overview/lib/news-trend";
import type { SocialTrendFields } from "@/modules/social/overview/lib/social-trend";
import type { WebsiteTrendFields } from "@/modules/website/overview/lib/website-trend";
import type { YoutubeTrendFields } from "@/modules/youtube/overview/lib/youtube-trend";

/** Satu bulan pada grafik tren lintas channel. null = channel itu belum punya data bulan tersebut. */
export type TrendPoint = { month: string } & WebsiteTrendFields & NewsTrendFields & YoutubeTrendFields & SocialTrendFields;
