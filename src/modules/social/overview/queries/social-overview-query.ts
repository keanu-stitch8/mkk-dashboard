import "server-only";
import { cache } from "react";
import { loadByMonth } from "@/modules/shared/lib/by-month";
import { channelPageMonths } from "@/modules/shared/lib/trend-months";
import { buildSocialOverview } from "../lib/social-overview";
import { getSocialAudience } from "../services/social-audience-service";
import { getSocialSummary } from "../services/social-summary-service";
import type { SocialOverview } from "../types/social-overview";

/** Satu ringkasan per bulan (tren + bulan lalu), paralel; bulan yang sama tidak dihitung dua kali. */
export const getSocialOverview = cache(async (month: string): Promise<SocialOverview> => {
  const [byMonth, audience] = await Promise.all([loadByMonth(channelPageMonths(month), getSocialSummary), getSocialAudience(month)]);
  return buildSocialOverview(month, byMonth, audience);
});
