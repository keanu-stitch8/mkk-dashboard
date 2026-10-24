import { isRecap } from "@/modules/report/pipeline/youtube-series";
import { categoryLabel, youtubeFormat } from "@/modules/shared/lib/taxonomy";
import type { YoutubeLogEntry } from "../../shared/types/youtube";
import type { YoutubeLogRow, YoutubeLogs } from "../types/youtube-log";

/** Summary (Calendar Timeline) + video in review dari Gantt → baris Publishing Log. */
export function buildYoutubeLogs(logs: YoutubeLogEntry[], reviewItems: string[]): YoutubeLogs {
  const rows = logs.map((l): YoutubeLogRow => ({
    date: l.date,
    title: l.title,
    url: l.url,
    status: l.status,
    fields: { format: youtubeFormat(l.format, l.category, isRecap(l.title, l.format)), category: categoryLabel(l.category), editor: l.editor },
    // thumbnail "medium" YouTube Data API = 320×180 (16:9); high/standard 4:3
    thumb: l.videoId ? `https://i.ytimg.com/vi/${l.videoId}/mqdefault.jpg` : null,
  }));
  // video in review (Gantt) yang sudah ada di Summary cukup ditandai review; sisanya ditambahkan tanpa tanggal
  const byTitle = new Map(rows.map((r) => [r.title.trim().toLowerCase(), r]));
  for (const label of reviewItems) {
    const hit = byTitle.get(label.trim().toLowerCase());
    if (hit && hit.status !== "publish") hit.status = "review";
    else if (!hit) rows.push({ date: null, title: label, url: null, status: "review", fields: { format: null, category: null, editor: null }, thumb: null });
  }
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return { rows, published: count("publish"), inReview: count("review") };
}
