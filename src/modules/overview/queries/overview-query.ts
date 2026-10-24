import "server-only";
import { cache } from "react";
import { prevMonth } from "@/modules/shared/lib/month";
import { getMonthBundle } from "@/modules/channels/services/month-bundle-service";
import { loadByMonth } from "@/modules/shared/lib/by-month";
import { channelPageMonths } from "@/modules/shared/lib/trend-months";
import { buildOverview } from "../lib/overview";
import { getAudience } from "../services/audience-service";
import type { Overview } from "../types/overview";

/** Satu bundle per bulan (tren + bulan lalu) — bulan berjalan tidak dihitung dua kali seperti getMonthAndPrev + getTrend. */
export const getOverview = cache(async (month: string): Promise<Overview> => {
  const [bundles, audience, prevAudience] = await Promise.all([loadByMonth(channelPageMonths(month), getMonthBundle), getAudience(month), getAudience(prevMonth(month))]);
  return buildOverview(month, bundles, audience, prevAudience);
});
