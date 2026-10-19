// Data laporan News: angka KPI dari summary dashboard (identik dengan dashboard) + daftar artikel dari Publishing Log.
import { getMonthAndPrev } from "../../data/summary";
import { daysInMonth, prevMonth } from "../../month";
import { fmtDurationEn, kpiData, NEWS_KPIS } from "../kpi";
import { enMonth } from "../month";
import type { Cell, ReportChannel, ReportData } from "../types";
import { newsFindings } from "./news-narrative";

/**
 * Baris tetap tabel kategori & tipe di Executive Summary. Rentang pie chart menunjuk baris-baris ini, jadi jumlahnya
 * tidak boleh berubah antar bulan (template: scripts/report-template-news.ts). Kategori di luar daftar → "Other".
 */
export const NEWS_CATEGORIES = ["Akomodasi", "Arena", "Atlet", "Atraksi", "Kegiatan", "Kesehatan", "Komunitas", "Kuliner", "Olahraga", "Pelatih", "Perlengkapan", "Profil", "Tentang Kudus", "UMKM"];
export const NEWS_TYPES = ["Editorial", "Features", "Hard News"];
export const NEWS_CATEGORY_SLOTS = NEWS_CATEGORIES.length + 1; // + Other

const div = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : a / b);
const sumOf = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const sec = (v: number | null | undefined) => (v == null ? null : Math.round(v));
/** "2026-09-01" → serial tanggal Sheets (angka; format tanggal dari template). */
export const sheetDate = (iso: string | null) => (iso ? (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86_400_000 : null);
const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();
const STATUS_EN: Record<string, string> = { publish: "Published", review: "In review", draft: "Draft" };

/** Hitung per kategori ke slot tetap; kategori tak dikenal / kosong masuk "Other". */
export function categorySlots(counts: { label: string; count: number }[]): { name: string; count: number }[] {
  const slots = [...NEWS_CATEGORIES, "Other"].map((name) => ({ name, count: 0 }));
  for (const c of counts) {
    const i = NEWS_CATEGORIES.findIndex((k) => k.toLowerCase() === c.label.trim().toLowerCase());
    slots[i >= 0 ? i : slots.length - 1].count += c.count;
  }
  return slots;
}

export async function buildNews(month: string): Promise<ReportData> {
  const prev = prevMonth(month);
  const { cur, prev: prevBundle } = await getMonthAndPrev(month);
  const n = cur.news;
  const p = prevBundle.news.hasData ? prevBundle.news : null;
  const kpi = kpiData(NEWS_KPIS, n, p);
  const quota = n.quota.value;

  const published = n.articles.filter((a) => a.status === "publish");
  const review = n.articles.filter((a) => a.status === "review");
  const top = n.topArticles[0];

  const typeRows = NEWS_TYPES.map((name) => ({ name, count: n.byType.find((t) => t.label === name)?.count ?? 0 }));
  const cats = categorySlots(n.byCategory);
  const unpublished = Math.max(quota - sumOf(cats.map((c) => c.count)) - n.inReview, 0);

  const findings = newsFindings({
    monthLabel: enMonth(month),
    prevMonthLabel: enMonth(prev),
    quota,
    published: n.published,
    inReview: n.inReview,
    delivered: n.delivered,
    achievement: n.achievement,
    prevAchievement: p?.achievement ?? null,
    totalViews: n.totalViews,
    prevViews: p?.totalViews ?? null,
    viewsPerArticle: n.viewsPerArticle,
    top: n.topArticles.map((a) => ({ title: oneLine(a.title), views: a.views ?? 0 })),
    byType: n.byType,
    byCategory: n.byCategory,
    activeDays: n.activeDays,
    daysInMonth: daysInMonth(month).length,
    emptyStreak: n.emptyStreak,
    matched: n.matchedCount,
    publishedListed: published.length,
  });

  const values: Record<string, Cell> = {
    month_label: enMonth(month),
    month_upper: enMonth(month).toUpperCase(),
    month_name: enMonth(month).split(" ")[0],
    year: Number(month.slice(0, 4)),
    prev_month_label: enMonth(prev),
    period: `1–${daysInMonth(month).length} ${enMonth(month)}`,
    ...kpi.values,
    quota,
    published: n.published,
    in_review: n.inReview,
    delivered: n.delivered,
    achievement: n.achievement,
    published_share: div(n.published, quota),
    review_share: div(n.inReview, quota),
    remaining: Math.max(quota - n.published, 0),
    total_views: n.totalViews,
    matched: n.matchedCount,
    listed: published.length,
    match_note:
      !n.viewsSource
        ? "Views are not available yet for this month."
        : n.matchedCount === published.length
          ? `All ${published.length} published URLs were matched.`
          : `${n.matchedCount} of ${published.length} published URLs were matched; the rest show no views.`,
    "top.title": top ? oneLine(top.title) : "—",
    "top.views": top?.views ?? null,
    "top.avg_time": top?.avgEngagementTime != null ? fmtDurationEn(top.avgEngagementTime) : "—",
    "top.category": top?.category ?? "",
    "types.total": sumOf(typeRows.map((t) => t.count)),
    "cat.review": n.inReview,
    "cat.review_share": div(n.inReview, quota),
    "cat.unpublished": unpublished,
    "cat.unpublished_share": div(unpublished, quota),
    "cat.quota": quota,
    "articles.total_views": n.totalViews,
    "articles.total_users": n.readers,
    "articles.total_vpu": div(n.totalViews, n.readers),
    "articles.total_avg_time": sec(n.avgEngagementTime),
  };
  const typeTotal = sumOf(typeRows.map((t) => t.count));
  typeRows.forEach((t, i) => {
    values[`type.${i + 1}.name`] = t.name;
    values[`type.${i + 1}.count`] = t.count;
    values[`type.${i + 1}.share`] = div(t.count, typeTotal) ?? 0;
  });
  cats.forEach((c, i) => {
    values[`cat.${i + 1}.name`] = c.name;
    values[`cat.${i + 1}.count`] = c.count;
    values[`cat.${i + 1}.share`] = div(c.count, quota) ?? 0;
  });

  const logRow = (a: (typeof n.articles)[number], i: number) => ({
    no: i + 1,
    date: sheetDate(a.date),
    title: oneLine(a.title),
    url: a.url ?? "",
    reporter: a.reporter ?? "",
    category: a.category ?? "",
    type: a.type ?? "",
    status: STATUS_EN[a.status] ?? a.status,
    method: a.method ?? "",
  });

  return {
    values,
    tones: kpi.tones,
    autoHeight: ["articles", "log", "review"],
    tables: {
      findings: findings.map((text) => ({ text })),
      articles: published.map((a, i) => ({
        no: i + 1,
        date: sheetDate(a.date),
        title: oneLine(a.title),
        type: a.type ?? "",
        category: a.category ?? "",
        views: a.views,
        users: a.activeUsers,
        views_per_user: div(a.views, a.activeUsers),
        avg_time: sec(a.avgEngagementTime),
        match: a.matched ? "Matched" : "Not matched",
        url: a.url ?? "",
      })),
      log: published.map(logRow),
      review: review.map((a, i) => ({ ...logRow(a, i), submitted: sheetDate(a.submittedDate) })),
    },
  };
}

export const news: ReportChannel = { id: "news", title: "News", templateEnv: "REPORT_TEMPLATE_NEWS", build: buildNews };
