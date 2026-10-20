// Narasi laporan YouTube untuk client (bahasa Inggris). Gaya sama dengan Website/News: kalimat pendek dan lugas,
// tanpa tanda pisah atau jargon, satu fakta per kalimat. Murni — mudah dites.

export interface YoutubeNarrativeInput {
  monthLabel: string;
  prevMonthLabel: string;
  quota: number;
  published: number;
  recaps: number;
  series: { name: string; produced: number; publishedToDate: number; remaining: number } | null;
  views: number | null;
  prevViews: number | null;
  viewsPerVideo: number | null;
  /** urut views terbanyak */
  top: { title: string; views: number }[];
  impressions: number | null;
  ctr: number | null;
  /** video dengan CTR < 4% dan impressions ≥ 100 */
  lowCtr: number;
  watchHours: number | null;
  avgViewDurationSec: number | null;
  subsGained: number | null;
  subsLost: number | null;
}

const n = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;
const dur = (sec: number) => {
  const s = Math.round(sec);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} sec` : `${s} sec`;
};

export function youtubeFindings(i: YoutubeNarrativeInput): string[] {
  const out: string[] = [];
  if (i.quota > 0) {
    const recap = i.recaps > 0 ? ` This includes ${plural(i.recaps, "recap video")}.` : "";
    out.push(`${n(i.published)} of the ${n(i.quota)} planned videos were published (${pct(i.published / i.quota)}).${recap}`);
  }
  if (i.series)
    out.push(
      `The ${i.series.name} production series has ${n(i.series.publishedToDate)} of ${n(i.series.produced)} videos published, with ${n(i.series.remaining)} still to be released.`,
    );
  if (i.views != null) {
    const avg = i.viewsPerVideo != null ? `, an average of ${n(i.viewsPerVideo)} views per video` : "";
    out.push(`Videos published in ${i.monthLabel} received ${n(i.views)} views${avg}.`);
    if (i.prevViews) out.push(`Views ${i.views >= i.prevViews ? "rose" : "fell"} ${pct(Math.abs((i.views - i.prevViews) / i.prevViews))} from ${i.prevMonthLabel} (${n(i.prevViews)} to ${n(i.views)}).`);
  }
  // video teratas sudah tampil di blok "Top performing video" → di sini peringkat 2
  const [, b] = i.top;
  if (b) out.push(`The next most watched was "${b.title}" with ${plural(b.views, "view")}.`);
  if (i.impressions != null && i.ctr != null) {
    out.push(`Thumbnails were shown ${n(i.impressions)} times and ${pct(i.ctr, 2)} of them led to a view.`);
    if (i.lowCtr > 0) out.push(`${plural(i.lowCtr, "video")} had a click rate below 4%, so ${i.lowCtr === 1 ? "its" : "their"} title or thumbnail may need work.`);
  }
  if (i.watchHours != null) {
    const avd = i.avgViewDurationSec != null ? `, about ${dur(i.avgViewDurationSec)} per view` : "";
    out.push(`Viewers watched ${i.watchHours.toFixed(1)} hours in total${avd}.`);
  }
  if (i.subsGained != null) {
    const lost = i.subsLost ? ` and lost ${n(i.subsLost)}` : "";
    out.push(`The channel gained ${plural(i.subsGained, "new subscriber")}${lost} from these videos.`);
  }
  return out;
}
