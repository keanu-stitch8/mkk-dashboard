// Narasi laporan Social (Instagram) untuk client (bahasa Inggris). Gaya sama dengan laporan lain: kalimat pendek,
// angka kartu KPI tidak diulang kecuali diberi konteks, perubahan besar disertai penyebab dari data. Murni — mudah dites.
import { capitalize, list, monthOnly, n, plural, shareOf, shortTitle } from "./narrative-utils";

export interface SocialNarrativeInput {
  monthLabel: string;
  prevMonthLabel: string;
  quota: number;
  published: number;
  /** diserahkan, belum tayang per akhir bulan */
  inReview: number;
  /** published + in review */
  delivered: number;
  prevPublished: number | null;
  /** jumlah per format (label laporan), bulan ini & bulan lalu */
  formats: { label: string; count: number; prevCount: number | null }[];
  /** post feed/Reels urut views lifetime terbanyak */
  top: { title: string; views: number }[];
  /** rata-rata views per post per format (hanya format dengan post) */
  formatViews: { label: string; posts: number; avgViews: number }[];
  /** rata-rata views per post per kategori */
  categoryViews: { label: string; posts: number; avgViews: number }[];
  /** post penyumbang follow terbanyak */
  topFollows: { title: string; follows: number } | null;
}

export function socialFindings(i: SocialNarrativeInput): string[] {
  const out: string[] = [];
  const prevM = monthOnly(i.prevMonthLabel, i.monthLabel);
  // 1. kuota: delivered = published + in review (definisi sama dengan News & YouTube)
  // satu kalimat (bukan dua seperti News) supaya tabel kategori Executive Summary tetap muat di halaman 2
  if (i.quota > 0) {
    const split = i.inReview > 0 ? ` (${n(i.published)} live, ${n(i.inReview)} waiting for approval)` : "";
    out.push(
      i.delivered === i.quota
        ? `All ${n(i.quota)} planned posts were delivered${split}.`
        : i.delivered > i.quota
          ? `${n(i.delivered)} posts were delivered against a quota of ${n(i.quota)}${split}.`
          : `${n(i.delivered)} of the ${n(i.quota)} planned posts were delivered${split}, ${n(i.quota - i.delivered)} short of the quota.`,
    );
  }
  // 2. perubahan besar vs bulan lalu → format penyebabnya (mis. jumlah Stories)
  if (i.prevPublished && Math.abs(i.published - i.prevPublished) / i.prevPublished >= 0.3) {
    const total = i.published - i.prevPublished;
    const driver = i.formats
      .filter((f) => f.prevCount != null)
      .map((f) => ({ ...f, diff: f.count - f.prevCount! }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
    const rest = i.formats.filter((f) => f.label !== driver?.label && f.prevCount != null);
    const restNote = rest.length
      ? `; the other formats were ${Math.abs(rest.reduce((s, f) => s + f.count - f.prevCount!, 0)) <= 3 ? "similar" : "also different"} (${n(rest.reduce((s, f) => s + f.count, 0))} against ${n(rest.reduce((s, f) => s + f.prevCount!, 0))})`
      : "";
    out.push(
      driver && Math.abs(driver.diff) / Math.abs(total) >= 0.6
        ? `${total < 0 ? "Fewer" : "More"} posts went out than in ${prevM} (${n(i.published)} against ${n(i.prevPublished)}), mainly because of ${driver.label} (${n(driver.prevCount!)} in ${prevM}, ${n(driver.count)} now)${restNote}.`
        : `${total < 0 ? "Fewer" : "More"} posts went out than in ${prevM} (${n(i.published)} against ${n(i.prevPublished)}).`,
    );
  }
  // 3. komposisi format
  const fm = [...i.formats].filter((f) => f.count > 0).sort((a, b) => b.count - a.count);
  if (fm.length && i.published) {
    const [a, ...others] = fm;
    out.push(`${a.label} made up ${shareOf(a.count / i.published, "the output")} (${n(a.count)})${others.length ? `, followed by ${list(others.map((f) => `${f.label} (${n(f.count)})`))}` : ""}.`);
  }
  // 4. post teratas sudah tampil di blok "Top performing post" → di sini porsinya + peringkat 2
  const total = i.top.reduce((s, t) => s + t.views, 0);
  const [t1, t2] = i.top;
  if (t1 && total && t1.views / total >= 0.15)
    out.push(`The top post alone drew ${shareOf(t1.views / total, "all views on this month's feed posts and Reels")}.${t2 ? ` The next best was "${shortTitle(t2.title)}" with ${plural(t2.views, "view")}.` : ""}`);
  else if (t2) out.push(`The next best post was "${shortTitle(t2.title)}" with ${plural(t2.views, "view")}.`);
  // 5. format mana yang paling ditonton per post
  const fv = [...i.formatViews].filter((f) => f.posts >= 2).sort((a, b) => b.avgViews - a.avgViews);
  if (fv.length >= 2) out.push(`${fv[0].label} averaged ${n(fv[0].avgViews)} views per post, against ${n(fv[1].avgViews)} for ${fv[1].label}.`);
  // 6. kategori terbaik per post (minimal 2 post supaya tidak kebetulan)
  const cv = [...i.categoryViews].filter((c) => c.posts >= 2).sort((a, b) => b.avgViews - a.avgViews)[0];
  // kategori = kelompok post yang sama dengan format terbaik (mis. semua Feeds = Featured News) → tidak diulang
  const sameAsFormat = cv && fv[0] && cv.posts === fv[0].posts && Math.round(cv.avgViews) === Math.round(fv[0].avgViews);
  if (cv && !sameAsFormat) out.push(`${cv.label} posts were the most watched, with ${n(cv.avgViews)} views each on average across ${plural(cv.posts, "post")}.`);
  // 7. sumber follower baru
  if (i.topFollows && i.topFollows.follows > 0) out.push(`"${shortTitle(i.topFollows.title)}" brought in the most new followers (${n(i.topFollows.follows)}).`);
  return out.map(capitalize);
}
