// Narasi laporan YouTube untuk client (bahasa Inggris). Gaya sama dengan Website/News: kalimat pendek dan lugas,
// tanpa tanda pisah atau jargon; angka kartu KPI tidak diulang kecuali diberi konteks. Murni — mudah dites.
import { changeWithCause, list, monthOnly, n, pct, plural, shortTitle } from "./narrative-utils";

export interface YoutubeNarrativeInput {
  monthLabel: string;
  prevMonthLabel: string;
  quota: number;
  published: number;
  recaps: number;
  series: { name: string; produced: number; publishedToDate: number; remaining: number } | null;
  views: number | null;
  prevViews: number | null;
  /** urut views terbanyak */
  top: { title: string; views: number }[];
  /** video teratas bulan lalu (penyebab perubahan views) */
  prevTop: { title: string; views: number } | null;
  /** video yang dipublish di 7 hari terakhir bulan: sedikit waktu mengumpulkan views */
  late: { title: string; date: string; days: number }[];
  /** CTR < 4% dengan impressions ≥ 100 */
  lowCtr: { title: string; ctr: number }[];
  /** rata-rata bagian video yang ditonton (avg view duration ÷ durasi, tertimbang views) */
  watchedShare: number | null;
  avgViewDurationSec: number | null;
  subsGained: number | null;
  /** video penyumbang subscriber terbanyak */
  topSubs: { title: string; subs: number } | null;
}

const dur = (sec: number) => {
  const s = Math.round(sec);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} sec` : `${s} sec`;
};
const dayMonth = (iso: string, monthLabel: string) => `${Number(iso.slice(8, 10))} ${monthLabel.split(" ")[0]}`;

export function youtubeFindings(i: YoutubeNarrativeInput): string[] {
  const out: string[] = [];
  const prevM = monthOnly(i.prevMonthLabel, i.monthLabel);
  if (i.quota > 0) {
    const recap = i.recaps > 0 ? `, including ${plural(i.recaps, "recap")}` : "";
    out.push(
      i.published === i.quota
        ? `All ${n(i.quota)} planned videos were published${recap}.`
        : i.published > i.quota
          ? `${n(i.published)} videos were published against a quota of ${n(i.quota)}${recap}.`
          : `${n(i.published)} of the ${n(i.quota)} planned videos were published${recap}.`,
    );
  }
  if (i.series)
    out.push(`The ${i.series.name} series now has ${n(i.series.publishedToDate)} of its ${n(i.series.produced)} videos out, with ${n(i.series.remaining)} still to be released.`);
  if (i.views != null && i.prevViews)
    out.push(
      changeWithCause({
        metric: "Views",
        unit: "video",
        cur: i.views,
        prev: i.prevViews,
        prevMonth: prevM,
        top: i.top[0] ? { title: i.top[0].title, value: i.top[0].views } : null,
        prevTop: i.prevTop ? { title: i.prevTop.title, value: i.prevTop.views } : null,
      }),
    );
  // video teratas sudah tampil di blok "Top performing video" → di sini peringkat 2
  const [, b] = i.top;
  if (b) out.push(`The next most watched was "${shortTitle(b.title)}" with ${plural(b.views, "view")}.`);
  if (i.late.length === 1) {
    const v = i.late[0];
    out.push(`"${shortTitle(v.title)}" went live on ${dayMonth(v.date, i.monthLabel)}, so it had only ${plural(v.days, "day")} to collect views for this report.`);
  } else if (i.late.length > 1)
    out.push(`${list(i.late.map((v) => `"${shortTitle(v.title)}"`))} went live in the last week of the month, so they had less time to collect views.`);
  if (i.lowCtr.length)
    out.push(
      `${list(i.lowCtr.map((v) => `"${shortTitle(v.title)}" (${pct(v.ctr)})`))} ${i.lowCtr.length === 1 ? "was" : "were"} rarely clicked when shown. ${i.lowCtr.length === 1 ? "Its title or thumbnail" : "Their titles or thumbnails"} may need work.`,
    );
  if (i.watchedShare != null && i.avgViewDurationSec != null)
    out.push(`Viewers watched about ${pct(i.watchedShare, 0)} of each video on average (${dur(i.avgViewDurationSec)} per view).`);
  if (i.subsGained) {
    const from = i.topSubs && i.topSubs.subs > 0 && i.topSubs.subs / i.subsGained >= 0.5 ? `, ${n(i.topSubs.subs)} of them from "${shortTitle(i.topSubs.title)}"` : "";
    out.push(`The videos brought in ${plural(i.subsGained, "new subscriber")}${from}.`);
  }
  return out;
}
