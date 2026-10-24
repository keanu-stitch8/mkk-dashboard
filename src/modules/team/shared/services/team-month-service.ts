import "server-only";
import { findBriefMonths, findStoryMonths } from "../repositories/team-repository";

/** Bulan yang punya Story atau Brief, terbaru dulu (untuk pilihan bulan). */
export async function teamMonths(): Promise<string[]> {
  const [s, b] = await Promise.all([findStoryMonths(), findBriefMonths()]);
  return [...new Set([...s, ...b].map((x) => x.month))].sort().reverse();
}
