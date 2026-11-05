import { applyMonth, type Dataset, type ParseResult } from "@/modules/import/parsers";
import { csvFollowsNote, validCsvDate } from "@/modules/social/shared/lib/csv-follows";

export type InstagramCsvMode = "auto" | "follows" | "replace";
export interface InstagramUploadOptions { mode: InstagramCsvMode; observedOn: string | null }

export function instagramUploadOptions(mode: string, observedOn: string, today: string): InstagramUploadOptions {
  if (!["auto", "follows", "replace"].includes(mode)) throw new Error("Choose a valid Instagram CSV import mode.");
  if (observedOn && (!validCsvDate(observedOn) || observedOn > today)) throw new Error("Choose a valid CSV export date that is not in the future.");
  return { mode: mode as InstagramCsvMode, observedOn: observedOn || null };
}

export function followsOnlyDataset(raw: Dataset, month: string | null, observedOn: string | null): Dataset {
  const ds = month ? applyMonth(raw, month) : raw;
  const byId = new Map<string, Dataset["rows"][number]>();
  for (const row of ds.rows) {
    if (row.platform !== "instagram" || typeof row.postId !== "string" || typeof row.follows !== "number" || !Number.isFinite(row.follows) || row.follows < 0) continue;
    if (observedOn && typeof row.date === "string" && row.date > observedOn) throw new Error("The CSV export date cannot be earlier than a post's publish date.");
    if (byId.has(row.postId) && byId.get(row.postId)!.follows !== row.follows) throw new Error(`Conflicting follows for Post ID ${row.postId}. Upload one export at a time.`);
    byId.set(row.postId, { postId: row.postId, date: row.date, follows: row.follows, _date: row._date ?? null });
  }
  return {
    ...ds, key: "meta_ig_follows", rows: [...byId.values()], metrics: [], breakdowns: [],
    columns: ds.columns.filter((c) => ["postId", "publishTime", "follows"].includes(c.field)),
    unmatched: [],
    warnings: [...ds.warnings, "Only per-post follows will be saved separately. Account insights, views and other post metrics stay unchanged.", csvFollowsNote(observedOn), ...(observedOn ? [] : ["Export date is unknown. Reports will show the CSV upload date, not an assumed measurement date."])],
  };
}

/** Decide in the shared preview/commit path, so the save operation cannot silently use a different mode. */
export function prepareInstagramUpload(parsed: ParseResult, month: string | null, existing: { source: string; fileName: string }[], locked: boolean, options: InstagramUploadOptions): ParseResult {
  const hasApi = existing.some((row) => row.source === "meta_instagram" && row.fileName.startsWith("API "));
  return { ...parsed, datasets: parsed.datasets.map((ds) => {
    if (ds.key !== "meta_instagram") return ds;
    const supplement = options.mode === "follows" || (options.mode === "auto" && (hasApi || locked));
    if (supplement) return followsOnlyDataset(ds, month, options.observedOn);
    if (locked) throw new Error("This Instagram month is locked. Use Follows only, or unlock the month before replacing its metrics.");
    return ds;
  }) };
}
