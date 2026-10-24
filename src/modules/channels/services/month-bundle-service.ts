import "server-only";
import { prevMonth } from "@/lib/month";
import { getNewsSummary } from "@/modules/news/overview/services/news-summary-service";
import { getSocialSummary } from "@/modules/social/overview/services/social-summary-service";
import { getWebsiteSummary } from "@/modules/website/overview/services/website-summary-service";
import { getYoutubeSummary } from "@/modules/youtube/overview/services/youtube-summary-service";
import type { MonthBundle } from "../types/month-bundle";

export async function getMonthBundle(month: string): Promise<MonthBundle> {
  const [website, news, youtube, social] = await Promise.all([getWebsiteSummary(month), getNewsSummary(month), getYoutubeSummary(month), getSocialSummary(month)]);
  return { month, website, news, youtube, social };
}

export async function getMonthAndPrev(month: string): Promise<{ cur: MonthBundle; prev: MonthBundle }> {
  const [cur, prev] = await Promise.all([getMonthBundle(month), getMonthBundle(prevMonth(month))]);
  return { cur, prev };
}
