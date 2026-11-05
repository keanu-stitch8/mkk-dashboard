import { csvFollowsDate } from "../lib/csv-follows";
import { dateIn, WIB } from "@/modules/shared/lib/tz";
import type { CsvPostFollows } from "../types/csv-follows";

export const toCsvPostFollows = (row: { label: string; value: number; import: { note: string | null; createdAt: Date } }): CsvPostFollows => ({
  postId: row.label,
  follows: row.value,
  observedOn: csvFollowsDate(row.import.note),
  importedOn: dateIn(row.import.createdAt, WIB),
});
