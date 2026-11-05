import { daysInMonth, isMonth } from "@/modules/shared/lib/month";
import type { CsvPostFollows } from "../types/csv-follows";

export const CSV_FOLLOWS_SOURCE = "meta_ig_follows";
export const CSV_FOLLOWS_DIMENSION = "instagram_post";
export const CSV_FOLLOWS_METRIC = "follows";

export const validCsvDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && isMonth(date.slice(0, 7)) && daysInMonth(date.slice(0, 7)).includes(date);

/** Import.note keeps readable provenance; unknown export dates must never be presented as measurement dates. */
export const csvFollowsNote = (observedOn: string | null) => `Instagram follows CSV export date: ${observedOn ?? "unknown"}.`;
export function csvFollowsDate(note: string | null): string | null {
  const date = note?.match(/^Instagram follows CSV export date: (\d{4}-\d{2}-\d{2})\./m)?.[1];
  return date && validCsvDate(date) ? date : null;
}

/** Only exact Instagram media IDs can receive a supplement; zero is an available measurement. */
export function withCsvFollows<T extends { platform: string; postId: string; follows: number | null }>(posts: T[], supplements: CsvPostFollows[]): (T & { followsCsv: CsvPostFollows | null; followsRecorded: number | null })[] {
  const byId = new Map(supplements.map((row) => [row.postId, row]));
  return posts.map((post) => {
    const csv = post.platform === "instagram" ? byId.get(post.postId) ?? null : null;
    return { ...post, follows: csv?.follows ?? post.follows, followsRecorded: post.follows, followsCsv: csv };
  });
}
