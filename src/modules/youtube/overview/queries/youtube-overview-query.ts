import "server-only";
import { cache } from "react";
import { loadByMonth } from "@/modules/shared/lib/by-month";
import { channelPageMonths } from "@/modules/shared/lib/trend-months";
import { buildYoutubeOverview } from "../lib/youtube-overview";
import { getYoutubeSummary } from "../services/youtube-summary-service";
import type { YoutubeOverview } from "../types/youtube-overview";

/** Satu ringkasan per bulan (tren + bulan lalu), paralel; bulan yang sama tidak dihitung dua kali. */
export const getYoutubeOverview = cache(async (month: string): Promise<YoutubeOverview> => {
  return buildYoutubeOverview(month, await loadByMonth(channelPageMonths(month), getYoutubeSummary));
});
