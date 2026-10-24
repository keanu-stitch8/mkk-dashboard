import { LOG_FILES, TRACKER_FILES } from "@/modules/connectors/sources/sheets/map";
import { lastMonths } from "@/modules/shared/lib/month";
import type { SourceLogDef, SourceLogImport, SourceLogs } from "../types/source-logs";

/** Data log yang ditarik dari Google Sheets, urut per channel. */
export const LOG_SOURCES: SourceLogDef[] = [
  { key: "news_log", channel: "News", data: "Articles (published + in review)", file: LOG_FILES.news.label },
  { key: "social_log", channel: "Social", data: "Published content", file: LOG_FILES.social.label },
  { key: "social_review", channel: "Social", data: "In review", file: TRACKER_FILES.social.label },
  { key: "yt_log", channel: "YouTube", data: "Video published", file: `${TRACKER_FILES.youtube.label} · tab Summary` },
  { key: "yt_review", channel: "YouTube", data: "In review", file: `${TRACKER_FILES.youtube.label} · tab Tracker (Gantt)` },
];

export const sourceLogHistory = (month: string) => lastMonths(month, 6).reverse();

export const sourceLogKey = (month: string, source: string) => `${month}|${source}`;

type ImportRow = Omit<SourceLogImport, "count"> & { month: string; source: string; rowCount: number; metrics: { key: string; value: number }[] };

export function buildSourceLogs(month: string, rows: ImportRow[]): SourceLogs {
  const imports: Record<string, SourceLogImport> = {};
  for (const r of rows) {
    // tracker: jumlah item in review (metrik *_in_review); log: jumlah baris
    const count = r.source.endsWith("_review") ? (r.metrics.find((m) => m.key.endsWith("_in_review"))?.value ?? null) : r.rowCount;
    imports[sourceLogKey(r.month, r.source)] = { fileName: r.fileName, fileUrl: r.fileUrl, note: r.note, createdAt: r.createdAt, count };
  }
  return { month, history: sourceLogHistory(month), sources: LOG_SOURCES, imports };
}
