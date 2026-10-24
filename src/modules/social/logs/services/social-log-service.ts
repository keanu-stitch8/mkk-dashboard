import "server-only";
import { getSocialSummary } from "../../overview/services/social-summary-service";
import { igThumbs } from "../../shared/services/ig-thumb-service";
import { buildSocialLogs } from "../lib/social-log-rows";
import type { SocialLogs } from "../types/social-log";

/** Link & thumbnail butuh pasangan log ↔ post IG, jadi memakai ringkasan Social (pencocokan yang sama dengan halaman Social). */
export async function getSocialLogs(month: string): Promise<SocialLogs> {
  const s = await getSocialSummary(month);
  // thumbnail = gambar post IG pasangannya (diunduh & disimpan lokal). Story tidak punya caption sehingga tidak bisa
  // dipasangkan ke story IG tertentu, dan API tidak memberi gambar story yang sudah lewat 24 jam → story tanpa link/gambar.
  const igThumb = await igThumbs(s.logs.flatMap((l) => (l.igMediaId ? [l.igMediaId] : [])));
  return buildSocialLogs(s.logs, s.inReviewItems, igThumb);
}
