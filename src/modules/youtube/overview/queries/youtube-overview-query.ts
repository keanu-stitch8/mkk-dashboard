import "server-only";
import { cache } from "react";
import { buildYoutubeOverview, youtubeOverviewMonths } from "../lib/youtube-overview";
import { getYoutubeSummary } from "../services/youtube-summary-service";
import type { YoutubeOverview } from "../types/youtube-overview";

/** Satu ringkasan per bulan (tren + bulan lalu), paralel; bulan yang sama tidak dihitung dua kali. */
export const getYoutubeOverview = cache(async (month: string): Promise<YoutubeOverview> => {
  const months = youtubeOverviewMonths(month);
  const summaries = await Promise.all(months.map((m) => getYoutubeSummary(m)));
  return buildYoutubeOverview(month, new Map(months.map((m, i) => [m, summaries[i]])));
});
