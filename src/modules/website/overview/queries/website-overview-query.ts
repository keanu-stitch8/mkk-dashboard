import "server-only";
import { cache } from "react";
import { loadByMonth } from "@/modules/shared/lib/by-month";
import { channelPageMonths } from "@/modules/shared/lib/trend-months";
import { buildWebsiteOverview } from "../lib/website-overview";
import { getWebsiteSummary } from "../services/website-summary-service";
import type { WebsiteOverview } from "../types/website-overview";

/** Satu ringkasan per bulan (tren + bulan lalu), paralel; bulan yang sama tidak dihitung dua kali. */
export const getWebsiteOverview = cache(async (month: string): Promise<WebsiteOverview> => {
  return buildWebsiteOverview(month, await loadByMonth(channelPageMonths(month), getWebsiteSummary));
});
