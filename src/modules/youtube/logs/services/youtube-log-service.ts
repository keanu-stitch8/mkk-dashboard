import "server-only";
import { toYoutubeLogEntry } from "../../shared/mappers/youtube-mapper";
import { findYoutubeLogs, findYoutubeReviewItems } from "../../shared/repositories/youtube-repository";
import { buildYoutubeLogs } from "../lib/youtube-log-rows";
import type { YoutubeLogs } from "../types/youtube-log";

export async function getYoutubeLogs(month: string): Promise<YoutubeLogs> {
  const [logs, reviewItems] = await Promise.all([findYoutubeLogs(month), findYoutubeReviewItems(month)]);
  return buildYoutubeLogs(logs.map(toYoutubeLogEntry), reviewItems.map((b) => b.label));
}
