// Data laporan Social (Instagram saja): kartu KPI = insight akun selama bulan (sama dengan dashboard, socialKpiSources),
// tabel per post = metrik lifetime post feed/Reels yang dipublish bulan ini, jumlah & format dari Publishing Log.
import { getMonthAndPrev, socialKpiSources } from "../../data/summary";
import { daysInMonth, prevMonth } from "../../month";
import { kpiData, SOCIAL_KPIS } from "../kpi";
import { enMonth } from "../month";
import type { Cell, ReportChannel, ReportData } from "../types";
import { sheetDate } from "./news";
import { socialFindings } from "./social-narrative";

/** Baris tetap tabel format & kategori di Executive Summary (rentang pie chart menunjuk baris-baris ini). */
export const SOC_FORMATS: [string, string][] = [
  ["feeds", "Feeds"],
  ["reels", "Reels"],
  ["story", "Stories"],
  ["video", "Videos"],
];
export const SOC_CATEGORIES = ["Audience Engagements", "Featured News", "Featured Video", "Highlight", "Schedule", "Teaser", "Teaser Editorial Feature", "Teaser Recap"];
export const SOC_CATEGORY_SLOTS = SOC_CATEGORIES.length + 1; // + Other

const CHANNEL_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", threads: "Threads", youtube: "YouTube" };
const div = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : a / b);
const sumOf = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const norm = (s: string) => s.trim().toLowerCase();

/** Format log/Meta → label laporan (carousel & foto = Feeds). */
export const formatLabel = (f: string) => SOC_FORMATS.find(([k]) => k === f)?.[1] ?? (["carousel", "photo"].includes(f) ? "Feeds" : f);

/** Judul post: judul Publishing Log, jika tidak ada → kalimat pertama caption (maks. ~70 huruf). */
export function postTitle(title: string | null, caption: string | null): string {
  if (title?.trim()) return title.trim().replace(/\s+/g, " ");
  const first = (caption ?? "").split(/\n/)[0].trim();
  const sentence = first.split(/(?<=[.!?])\s/)[0];
  const t = sentence.length <= 70 ? sentence : `${sentence.slice(0, 67).replace(/\s+\S*$/, "")}...`;
  return t || "(no caption)";
}

/** Label in review Task Progress ("reels · Judul") → format laporan + judul. */
export function reviewItem(label: string): { format: string; title: string } {
  const [format, ...rest] = label.split(" · ");
  const title = rest.join(" · ");
  return { format: formatLabel(format), title: !title || title === "(tanpa judul)" ? "(untitled)" : title };
}

/** Hitung per kategori ke slot tetap; kategori tak dikenal / kosong masuk "Other". */
export function socCategorySlots(categories: (string | null)[]): { name: string; count: number }[] {
  const slots = [...SOC_CATEGORIES, "Other"].map((name) => ({ name, count: 0 }));
  for (const c of categories) {
    const i = SOC_CATEGORIES.findIndex((k) => norm(k) === norm(c ?? ""));
    slots[i >= 0 ? i : slots.length - 1].count++;
  }
  return slots;
}

export async function buildSocial(month: string): Promise<ReportData> {
  const prev = prevMonth(month);
  const { cur, prev: prevBundle } = await getMonthAndPrev(month);
  const s = cur.social;
  const ps = prevBundle.social.hasData ? prevBundle.social : null;
  const src = socialKpiSources(s, ps);
  const kpi = kpiData(SOCIAL_KPIS, src.cur, src.prev);
  const quota = src.cur.quota.value;
  const days = daysInMonth(month).length;

  const logs = s.logs.filter((l) => l.status === "publish");
  const prevLogs = ps?.logs.filter((l) => l.status === "publish") ?? null;
  const formatRows = SOC_FORMATS.map(([k, label]) => ({
    label,
    count: logs.filter((l) => l.format === k).length,
    prevCount: prevLogs ? prevLogs.filter((l) => l.format === k).length : null,
  }));
  const cats = socCategorySlots(logs.map((l) => l.category));
  // delivered = published + in review (Task Progress, snapshot akhir bulan) — definisi sama dengan News & YouTube
  const inReview = s.inReview;
  const delivered = src.cur.delivered;
  const unpublished = Math.max(quota - delivered, 0);
  const review = s.inReviewItems.map(reviewItem);

  // post feed/Reels Instagram yang dipublish bulan ini (metrik lifetime per post)
  const posts = s.posts
    .filter((p) => p.platform === "instagram" && p.format !== "story")
    .map((p) => ({ ...p, name: postTitle(p.title, p.caption), label: formatLabel(p.format) }))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const byViews = [...posts].filter((p) => p.views != null).sort((a, b) => b.views! - a.views!);
  const top = byViews[0];
  const avgBy = (key: (p: (typeof posts)[number]) => string | null) =>
    [...new Set(posts.map(key).filter((k): k is string => !!k))].map((label) => {
      const rows = posts.filter((p) => key(p) === label);
      return { label, posts: rows.length, avgViews: sumOf(rows.map((p) => p.views)) / rows.length };
    });
  // link post: dari log, jika kosong → permalink Instagram post yang cocok dengan baris log (Stories tidak punya)
  const permalink = new Map(posts.filter((p) => p.title && p.permalink).map((p) => [norm(p.title!), p.permalink!]));
  const topFollows = [...posts].filter((p) => p.follows).sort((a, b) => b.follows! - a.follows!)[0];

  const findings = socialFindings({
    monthLabel: enMonth(month),
    prevMonthLabel: enMonth(prev),
    quota,
    published: src.cur.published,
    inReview,
    delivered,
    prevPublished: src.prev?.published ?? null,
    formats: formatRows,
    top: byViews.map((p) => ({ title: p.name, views: p.views! })),
    formatViews: avgBy((p) => p.label),
    categoryViews: avgBy((p) => p.category),
    topFollows: topFollows ? { title: topFollows.name, follows: topFollows.follows! } : null,
  });

  const values: Record<string, Cell> = {
    month_label: enMonth(month),
    month_upper: enMonth(month).toUpperCase(),
    month_name: enMonth(month).split(" ")[0],
    year: Number(month.slice(0, 4)),
    prev_month_label: enMonth(prev),
    period: `1–${days} ${enMonth(month)}`,
    ...kpi.values,
    quota,
    published: src.cur.published,
    in_review: inReview,
    delivered,
    achievement: div(delivered, quota),
    // sama dengan QuotaHero dashboard: sisa = kuota − delivered
    remaining: unpublished,
    "top.title": top?.name ?? "—",
    "top.views": top?.views ?? null,
    "top.reach": top?.reach ?? null,
    "formats.total": sumOf(formatRows.map((f) => f.count)),
    "cat.review": inReview,
    "cat.review_share": div(inReview, quota) ?? 0,
    "cat.unpublished": unpublished,
    "cat.unpublished_share": div(unpublished, quota) ?? 0,
    "cat.quota": quota,
    listed: posts.length,
    "posts.total_reach": sumOf(posts.map((p) => p.reach)),
    "posts.total_views": sumOf(posts.map((p) => p.views)),
    "posts.total_follows": sumOf(posts.map((p) => p.follows)),
    "posts.total_interactions": sumOf(posts.map((p) => p.interactions)),
    "posts.total_likes": sumOf(posts.map((p) => p.likes)),
    "posts.total_comments": sumOf(posts.map((p) => p.comments)),
    "posts.total_shares": sumOf(posts.map((p) => p.shares)),
    "posts.total_saves": sumOf(posts.map((p) => p.saves)),
  };
  const fmtTotal = sumOf(formatRows.map((f) => f.count));
  formatRows.forEach((f, i) => {
    values[`fmt.${i + 1}.name`] = f.label;
    values[`fmt.${i + 1}.count`] = f.count;
    values[`fmt.${i + 1}.share`] = div(f.count, fmtTotal) ?? 0;
  });
  cats.forEach((c, i) => {
    values[`cat.${i + 1}.name`] = c.name;
    values[`cat.${i + 1}.count`] = c.count;
    values[`cat.${i + 1}.share`] = div(c.count, quota) ?? 0;
  });

  return {
    values,
    tones: kpi.tones,
    autoHeight: ["findings", "posts", "log"],
    // kategori "Other" (slot terakhir), In review & Unpublished hanya tampil jika ada isinya (tabel tetap muat di halaman 2)
    hideRows: [
      ...(cats.at(-1)!.count === 0 ? [`cat.${cats.length}.name`] : []),
      ...(inReview === 0 ? ["cat.review"] : []),
      ...(unpublished === 0 ? ["cat.unpublished"] : []),
    ],
    tables: {
      findings: findings.map((text) => ({ text })),
      posts: posts.map((p, i) => ({
        no: i + 1,
        date: sheetDate(p.date),
        title: p.name,
        format: p.label,
        category: p.category ?? "",
        reach: p.reach,
        views: p.views,
        follows: p.follows,
        interactions: p.interactions,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        saves: p.saves,
      })),
      log: [
        ...logs.map((l) => ({
          date: sheetDate(l.date),
          title: l.title ?? "",
          url: l.url ?? (l.title ? (permalink.get(norm(l.title)) ?? "") : ""),
          category: l.category ?? "",
          channels: l.platform
            .split(",")
            .map((c) => CHANNEL_LABEL[c.trim()] ?? c.trim())
            .join(", "),
          format: formatLabel(l.format),
          status: "Published",
        })),
        // lalu konten in review per akhir bulan (belum tayang → tanpa tanggal tayang & link)
        ...review.map((r) => ({ date: null, title: r.title, url: "", category: "", channels: "", format: r.format, status: "In review" })),
      ].map((row, i) => ({ no: i + 1, ...row })),
    },
  };
}

export const social: ReportChannel = { id: "social", title: "Social Media", templateEnv: "REPORT_TEMPLATE_SOCIAL", build: buildSocial };
