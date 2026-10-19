// Narasi laporan News untuk client (bahasa Inggris). Gaya sama dengan Website: kalimat pendek dan lugas,
// tanpa tanda pisah atau jargon, satu fakta per kalimat. Murni — mudah dites.

export interface NewsNarrativeInput {
  monthLabel: string;
  prevMonthLabel: string;
  quota: number;
  published: number;
  inReview: number;
  delivered: number;
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
  activeDays: number;
  daysInMonth: number;
  emptyStreak: { length: number; from: string | null; to: string | null };
  matched: number;
  /** artikel published yang ada di daftar (bisa beda dengan `published` jika diisi manual) */
  publishedListed: number;
}

const n = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;
const day = (iso: string) => String(Number(iso.slice(8, 10)));

export function newsFindings(i: NewsNarrativeInput): string[] {
  const out: string[] = [];
  if (i.quota > 0) {
    const short = i.delivered < i.quota ? `, ${n(i.quota - i.delivered)} short of the quota` : "";
    out.push(
      `${n(i.delivered)} of the ${n(i.quota)} planned articles were delivered (${pct(i.delivered / i.quota)})${short}. ${n(i.published)} ${i.published === 1 ? "is" : "are"} published and ${n(i.inReview)} ${i.inReview === 1 ? "is" : "are"} still in review.`,
    );
  }
  if (i.achievement != null && i.prevAchievement != null && Math.abs(i.achievement - i.prevAchievement) >= 0.001)
    out.push(
      `Quota achievement ${i.achievement > i.prevAchievement ? "rose" : "fell"} ${((Math.abs(i.achievement - i.prevAchievement)) * 100).toFixed(1)} percentage points from ${i.prevMonthLabel}.`,
    );
  if (i.totalViews != null) {
    const avg = i.viewsPerArticle != null ? `, an average of ${i.viewsPerArticle.toFixed(1)} views per article` : "";
    out.push(`Articles published in ${i.monthLabel} received ${n(i.totalViews)} views${avg}.`);
    if (i.prevViews)
      out.push(`Views ${i.totalViews >= i.prevViews ? "rose" : "fell"} ${pct(Math.abs((i.totalViews - i.prevViews) / i.prevViews))} from ${i.prevMonthLabel} (${n(i.prevViews)} to ${n(i.totalViews)}).`);
  }
  // artikel teratas sudah tampil di blok "Top performing article" → di sini peringkat 2 dan 3
  const [, b, c] = i.top;
  if (b) out.push(`The next most read ${c ? "were" : "was"} "${b.title}" (${plural(b.views, "view")})${c ? ` and "${c.title}" (${plural(c.views, "view")})` : ""}.`);
  const types = i.byType.filter((t) => t.count > 0);
  const mainType = [...types].sort((x, y) => y.count - x.count)[0];
  const listed = types.reduce((s, t) => s + t.count, 0);
  const bestType = types.length > 1 ? [...types].filter((t) => t.perContent != null).sort((x, y) => y.perContent! - x.perContent!)[0] : undefined;
  if (mainType && listed) {
    const share = `${mainType.label} made up the largest share with ${plural(mainType.count, "article")} (${pct(mainType.count / listed)})`;
    const perArticle = (t: { perContent: number | null }) => `the most views per article (${t.perContent!.toFixed(1)})`;
    out.push(
      !bestType ? `${share}.` : bestType.label === mainType.label ? `${share} and drew ${perArticle(bestType)}.` : `${share}, while ${bestType.label} drew ${perArticle(bestType)}.`,
    );
  }
  const bestCat = [...i.byCategory].filter((x) => x.views != null).sort((x, y) => y.views! - x.views!)[0];
  if (bestCat?.views) out.push(`${bestCat.label} was the most read category with ${n(bestCat.views)} views from ${plural(bestCat.count, "article")}.`);
  if (i.activeDays > 0) {
    const gap = i.emptyStreak;
    const gapText =
      gap.length > 1 && gap.from && gap.to
        ? ` The longest gap without a new article was ${gap.length} days (${day(gap.from)} to ${day(gap.to)} ${i.monthLabel.split(" ")[0]}).`
        : "";
    out.push(`New articles went live on ${i.activeDays} of ${i.daysInMonth} days.${gapText}`);
  }
  const missing = i.publishedListed - i.matched;
  if (missing > 0)
    out.push(`${plural(missing, "published article")} could not be matched to Google Analytics by URL, so ${missing === 1 ? "its" : "their"} views are not counted.`);
  return out;
}
