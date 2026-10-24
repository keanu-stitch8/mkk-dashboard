import "server-only";
import { cache } from "react";
import { loadByMonth } from "@/modules/shared/lib/by-month";
import { channelPageMonths } from "@/modules/shared/lib/trend-months";
import { buildNewsOverview } from "../lib/news-overview";
import { getNewsSummary } from "../services/news-summary-service";
import type { NewsOverview } from "../types/news-overview";

/** Satu ringkasan per bulan (tren + bulan lalu), paralel; bulan yang sama tidak dihitung dua kali. */
export const getNewsOverview = cache(async (month: string): Promise<NewsOverview> => {
  return buildNewsOverview(month, await loadByMonth(channelPageMonths(month), getNewsSummary));
});
