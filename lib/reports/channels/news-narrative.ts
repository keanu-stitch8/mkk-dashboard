// Narasi laporan News untuk client (bahasa Inggris). Gaya sama dengan Website: kalimat pendek dan lugas,
// tanpa tanda pisah atau jargon, satu fakta per kalimat. Murni — mudah dites.

export interface NewsNarrativeInput {
  monthLabel: string;
  prevMonthLabel: string;
  quota: number;
  published: number;
  inReview: number;
  delivered: number;
  /** bulan lalu (null = tidak ada data) */
  prevDelivered: number | null;
  prevPublished: number | null;
  /** artikel teratas bulan lalu (penyebab perubahan views) */
  prevTop: { title: string; views: number } | null;
  /** delivered ÷ kuota */
  achievement: number | null;
  prevAchievement: number | null;
  totalViews: number | null;
  prevViews: number | null;
  viewsPerArticle: number | null;
  /** urut views terbanyak */
  top: { title: string; views: number }[];
  byType: { label: string; count: number; views: number | null; perContent: number | null }[];
  byCategory: { label: string; count: number; views: number | null }[];
  matched: number;
  /** artikel published yang ada di daftar (bisa beda dengan `published` jika diisi manual) */
  publishedListed: number;
}

import { changeWithCause, count, monthOnly, n, plural, shareOf } from "./narrative-utils";

/**
 * Temuan News. Pembuka = delivered vs kuota & bulan lalu, lalu yang masih in review (published bisa turun walau
 * delivered naik); angka kartu KPI tidak diulang kecuali diberi konteks.
 */
export function newsFindings(i: NewsNarrativeInput): string[] {
  const out: string[] = [];
  const prevM = monthOnly(i.prevMonthLabel, i.monthLabel);
  if (i.quota > 0) {
    const vsPrev = i.prevDelivered != null && i.prevDelivered !== i.delivered ? `, ${i.delivered > i.prevDelivered ? "up" : "down"} from ${n(i.prevDelivered)} in ${prevM}` : "";
    const short = i.delivered < i.quota && !vsPrev ? `, ${n(i.quota - i.delivered)} short of the quota` : "";
    out.push(`${n(i.delivered)} of the ${n(i.quota)} planned articles were delivered${vsPrev}${short}.`);
    if (i.inReview > 0) {
      const d = i.prevPublished == null ? null : i.published - i.prevPublished;
      const cmp = d == null ? "" : d === 0 ? `, the same as ${prevM}` : `, ${count(Math.abs(d))} ${d > 0 ? "more" : "fewer"} than ${prevM}`;
      out.push(`${n(i.inReview)} ${i.inReview === 1 ? "is" : "are"} still waiting for approval, so ${n(i.published)} ${i.published === 1 ? "is" : "are"} live${cmp}.`);
    }
  }
  if (i.totalViews != null && i.prevViews)
    out.push(changeWithCause({ metric: "Views", unit: "article", cur: i.totalViews, prev: i.prevViews, prevMonth: prevM, top: i.top[0] ? { title: i.top[0].title, value: i.top[0].views } : null, prevTop: i.prevTop ? { title: i.prevTop.title, value: i.prevTop.views } : null }));
  // artikel teratas sudah tampil di blok "Top performing article" → di sini peringkat 2 dan 3
  const [, b, c] = i.top;
  if (b) out.push(`The next most read ${c ? "were" : "was"} "${b.title}" (${plural(b.views, "view")})${c ? ` and "${c.title}" (${n(c.views)})` : ""}.`);
  const types = i.byType.filter((t) => t.count > 0);
  const mainType = [...types].sort((x, y) => y.count - x.count)[0];
  const listed = types.reduce((s, t) => s + t.count, 0);
  const bestType = types.length > 1 ? [...types].filter((t) => t.perContent != null).sort((x, y) => y.perContent! - x.perContent!)[0] : undefined;
  if (mainType && listed) {
    const share = `${mainType.label} made up ${shareOf(mainType.count / listed, "the output")} (${plural(mainType.count, "article")})`;
    const perArticle = (t: { perContent: number | null }) => `the most views per article (${t.perContent!.toFixed(1)})`;
    out.push(
      !bestType ? `${share}.` : bestType.label === mainType.label ? `${share} and drew ${perArticle(bestType)}.` : `${share}, while ${bestType.label} drew ${perArticle(bestType)}.`,
    );
  }
  const bestCat = [...i.byCategory].filter((x) => x.views != null).sort((x, y) => y.views! - x.views!)[0];
  if (bestCat?.views) out.push(`${bestCat.label} was the most read category with ${n(bestCat.views)} views from ${plural(bestCat.count, "article")}.`);
  const missing = i.publishedListed - i.matched;
  if (missing > 0)
    out.push(`${plural(missing, "published article")} could not be matched to Google Analytics by URL, so ${missing === 1 ? "its" : "their"} views are not counted.`);
  return out;
}
