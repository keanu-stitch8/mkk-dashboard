// Ringkasan metrik per channel per bulan, dihitung dari tabel detail + total import + input manual.
import { prisma } from "../db";
import { addMonths, daysInMonth, lastMonths, prevMonth } from "../month";
import { getQuotas, type QuotaValue } from "./quota";
import { ACTIVE_SOCIAL_PLATFORMS, FORMAT_LABEL, OWN_SOCIAL_ACCOUNTS } from "../sources";
import { fmtNum, fmtPct } from "../format";
import type { Channel } from "../parsers/types";

const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const safeDiv = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : a / b);

async function manualFor(month: string, channel: Channel): Promise<Record<string, number>> {
  const rows = await prisma.manualMetric.findMany({ where: { month, channel } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Rangkaian hari kosong berturut-turut terpanjang dalam bulan (hanya sampai hari ini jika bulan berjalan). */
export function longestEmptyStreak(month: string, activeDates: Set<string>): { length: number; from: string | null; to: string | null } {
  const today = new Date().toISOString().slice(0, 10);
  const days = daysInMonth(month).filter((d) => d <= today);
  let best = { length: 0, from: null as string | null, to: null as string | null };
  let run = 0;
  let start: string | null = null;
  for (const d of days) {
    if (activeDates.has(d)) {
      run = 0;
      start = null;
      continue;
    }
    run++;
    start ??= d;
    if (run > best.length) best = { length: run, from: start, to: d };
  }
  return best;
}

export interface GroupStat {
  label: string;
  count: number;
  views: number;
  perContent: number | null;
}

function groupBy<T>(items: T[], keys: (t: T) => string[], views: (t: T) => number | null): GroupStat[] {
  const map = new Map<string, GroupStat>();
  for (const it of items) {
    for (const k of keys(it)) {
      const g = map.get(k) ?? { label: k, count: 0, views: 0, perContent: null };
      g.count++;
      g.views += views(it) ?? 0;
      map.set(k, g);
    }
  }
  return [...map.values()]
    .map((g) => ({ ...g, perContent: g.count ? g.views / g.count : null }))
    .sort((a, b) => b.views - a.views || b.count - a.count);
}

// ───────────────────────────── Website ─────────────────────────────

export async function getWebsiteSummary(month: string) {
  const [imports, channels, pages, landings, metrics, breakdowns, gscDaily, gscQueries, gscPages, manual] = await Promise.all([
    prisma.import.findMany({ where: { month, source: { startsWith: "g" } } }),
    prisma.ga4Channel.findMany({ where: { month } }),
    prisma.ga4Page.findMany({ where: { month }, orderBy: { views: "desc" } }),
    prisma.ga4Landing.findMany({ where: { month }, orderBy: { sessions: "desc" }, take: 10 }),
    prisma.metric.findMany({ where: { month, channel: "website" } }),
    prisma.breakdown.findMany({ where: { month, channel: "website" } }),
    prisma.gscDaily.findMany({ where: { month }, orderBy: { date: "asc" } }),
    prisma.gscQuery.findMany({ where: { month }, orderBy: { impressions: "desc" } }),
    prisma.gscPage.findMany({ where: { month }, orderBy: { clicks: "desc" } }),
    manualFor(month, "website"),
  ]);
  const metric = (k: string) => metrics.find((m) => m.key === k)?.value ?? null;

  let sessions: number | null = channels.length ? sum(channels.map((c) => c.sessions)) : metric("landing_sessions");
  let engagedSessions: number | null = channels.length && channels.some((c) => c.engagedSessions != null) ? sum(channels.map((c) => c.engagedSessions)) : null;
  const avgFromChannels = channels.length ? safeDiv(sum(channels.map((c) => (c.avgEngagementTime ?? 0) * c.sessions)), sessions) : null;
  let avgEngagementTime = avgFromChannels;
  let users = metric("users");
  let usersEstimated = false;
  if (users == null && metric("users_est") != null) {
    users = metric("users_est");
    usersEstimated = true;
  }
  let newUsers = metric("newUsers") ?? metric("newUsers_daily") ?? metric("newUsers_est");
  let pageviews: number | null = pages.length ? sum(pages.map((p) => p.views)) : null;

  // total resmi dari API GSC (jika ada) lebih akurat; tanpa itu (import CSV) dihitung dari data harian
  let gscClicks: number | null = metric("gsc_clicks") ?? (gscDaily.length ? sum(gscDaily.map((d) => d.clicks)) : null);
  let gscImpressions: number | null = metric("gsc_impressions") ?? (gscDaily.length ? sum(gscDaily.map((d) => d.impressions)) : null);
  let gscPosition: number | null = metric("gsc_position") ?? (gscDaily.length ? safeDiv(sum(gscDaily.map((d) => d.position * d.impressions)), gscImpressions) : null);

  // override manual
  if (manual.users != null) [users, usersEstimated] = [manual.users, false];
  if (manual.newUsers != null) newUsers = manual.newUsers;
  if (manual.sessions != null) sessions = manual.sessions;
  if (manual.engagedSessions != null) engagedSessions = manual.engagedSessions;
  if (manual.pageviews != null) pageviews = manual.pageviews;
  if (manual.avgEngagementTime != null) avgEngagementTime = manual.avgEngagementTime;
  if (manual.gscClicks != null) gscClicks = manual.gscClicks;
  if (manual.gscImpressions != null) gscImpressions = manual.gscImpressions;
  if (manual.gscPosition != null) gscPosition = manual.gscPosition;
  const engagementRate = manual.engagementRate ?? safeDiv(engagedSessions, sessions);
  const gscCtr = safeDiv(gscClicks, gscImpressions);

  const totalSessions = sum(channels.map((c) => c.sessions));
  const sourceBreakdown = channels
    .map((c) => ({ label: c.channel, sessions: c.sessions, share: safeDiv(c.sessions, totalSessions), engagementRate: c.engagementRate, avgEngagementTime: c.avgEngagementTime }))
    .sort((a, b) => b.sessions - a.sessions);

  // gabungkan path ganda (GA4 Pages bisa memecah per screen class)
  const pageMap = new Map<string, { path: string; title: string | null; views: number; activeUsers: number | null; avgEngagementTime: number | null }>();
  for (const p of pages) {
    const cur = pageMap.get(p.path);
    if (cur) cur.views += p.views;
    else pageMap.set(p.path, { path: p.path, title: p.title, views: p.views, activeUsers: p.activeUsers, avgEngagementTime: p.avgEngagementTime });
  }

  const bd = (dimension: string, m: string) =>
    breakdowns.filter((b) => b.dimension === dimension && b.metric === m).sort((a, b) => b.value - a.value).map((b) => ({ label: b.label, value: b.value }));

  return {
    month,
    hasData: imports.length > 0 || Object.keys(manual).length > 0,
    hasGa4: imports.some((i) => i.source.startsWith("ga4")) || manual.sessions != null || manual.users != null,
    hasGsc: imports.some((i) => i.source.startsWith("gsc")) || manual.gscImpressions != null,
    sources: imports.map((i) => i.source),
    users,
    usersEstimated,
    newUsers,
    sessions,
    engagedSessions,
    engagementRate,
    bounceRate: engagementRate == null ? null : 1 - engagementRate,
    avgEngagementTime,
    pageviews,
    hasPages: pages.length > 0,
    gscClicks,
    gscImpressions,
    gscCtr,
    gscPosition,
    sourceBreakdown,
    topPages: [...pageMap.values()].sort((a, b) => b.views - a.views).slice(0, 15),
    topLanding: landings,
    gscDaily: gscDaily.map((d) => ({ date: d.date, clicks: d.clicks, impressions: d.impressions, ctr: d.ctr, position: d.position })),
    topQueries: [...gscQueries].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 15),
    opportunityQueries: gscQueries.filter((q) => q.position >= 4 && q.position <= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 10),
    lowCtrPages: gscPages.filter((p) => p.impressions >= 30 && p.ctr < 0.02).sort((a, b) => b.impressions - a.impressions).slice(0, 5),
    gscTopPages: gscPages.slice(0, 15),
    cities: bd("city", "activeUsers").slice(0, 10),
    devices: bd("device", "clicks"),
    firstChannels: bd("first_channel", "newUsers"),
  };
}
export type WebsiteSummary = Awaited<ReturnType<typeof getWebsiteSummary>>;

// ───────────────────────────── News ─────────────────────────────

export async function getNewsSummary(month: string) {
  const [articles, ga4Pages, reportViews, quotas, manual, imports] = await Promise.all([
    prisma.newsArticle.findMany({ where: { month }, orderBy: { date: "asc" } }),
    prisma.ga4Page.findMany({ where: { month }, select: { path: true, views: true, activeUsers: true, avgEngagementTime: true } }),
    prisma.newsView.findMany({ where: { month } }),
    getQuotas(month),
    manualFor(month, "news"),
    prisma.import.findMany({ where: { month, source: { startsWith: "news" } } }),
  ]);
  const viewsSource: "ga4" | "report" | null = ga4Pages.length ? "ga4" : reportViews.length ? "report" : null;
  const viewMap = new Map<string, { views: number; activeUsers: number | null; avgEngagementTime: number | null }>();
  for (const p of viewsSource === "ga4" ? ga4Pages : reportViews) {
    const cur = viewMap.get(p.path);
    if (cur) cur.views += p.views;
    else viewMap.set(p.path, { views: p.views, activeUsers: p.activeUsers, avgEngagementTime: p.avgEngagementTime });
  }

  const enriched = articles.map((a) => {
    const hit = a.path ? viewMap.get(a.path) : undefined;
    return {
      ...a,
      matched: !!hit,
      views: hit?.views ?? null,
      activeUsers: hit?.activeUsers ?? null,
      avgEngagementTime: hit?.avgEngagementTime ?? null,
    };
  });
  const publishedList = enriched.filter((a) => a.status === "publish");
  const published = manual.published ?? publishedList.length;
  const inReview = manual.inReview ?? enriched.filter((a) => a.status === "review").length;
  const draft = enriched.filter((a) => a.status === "draft").length;
  const quota = quotas.news;
  const delivered = published + inReview;
  // tanpa artikel published (mis. log belum di-import) views = belum ada data, bukan 0
  const hasViews = !!viewsSource && publishedList.length > 0;
  const totalViews = manual.totalViews ?? (hasViews ? sum(publishedList.map((a) => a.views)) : null);
  const unmatched = viewsSource ? publishedList.filter((a) => !a.matched) : [];
  const zeroViews = publishedList.filter((a) => a.matched && (a.views ?? 0) === 0);

  const splitPeople = (s: string | null) =>
    (s ?? "")
      .split(/,|&|\/|;|\bdan\b/i)
      .map((x) => x.trim())
      .filter(Boolean);

  const publishDates = new Set(publishedList.map((a) => a.date).filter((d): d is string => !!d));
  const daily = daysInMonth(month).map((d) => ({ date: d, count: publishedList.filter((a) => a.date === d).length }));

  return {
    month,
    hasData: articles.length > 0 || Object.keys(manual).length > 0,
    sources: imports.map((i) => i.source),
    articles: enriched,
    published,
    inReview,
    draft,
    quota,
    delivered,
    achievement: safeDiv(delivered, quota.value),
    publishedRate: safeDiv(published, quota.value),
    viewsSource,
    totalViews,
    viewsPerArticle: safeDiv(totalViews, publishedList.length || published),
    /** jumlah active users per artikel (bisa dihitung ganda antar artikel) */
    readers: hasViews ? sum(publishedList.map((x) => x.activeUsers)) : null,
    /** rata-rata waktu engagement per pembaca, tertimbang active users */
    avgEngagementTime: hasViews
      ? safeDiv(sum(publishedList.map((x) => (x.avgEngagementTime ?? 0) * (x.activeUsers ?? 0))), sum(publishedList.map((x) => (x.avgEngagementTime != null ? x.activeUsers : 0))))
      : null,
    matchedCount: publishedList.filter((a) => a.matched).length,
    unmatched,
    zeroViews,
    topArticles: [...publishedList].filter((a) => a.views != null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 10),
    byCategory: groupBy(publishedList, (a) => [a.category ?? "(tanpa kategori)"], (a) => a.views),
    byReporter: groupBy(publishedList, (a) => {
      const p = splitPeople(a.reporter);
      return p.length ? p : ["(tanpa reporter)"];
    }, (a) => a.views),
    byType: groupBy(publishedList, (a) => [a.type ?? "(tanpa tipe)"], (a) => a.views),
    daily,
    activeDays: publishDates.size,
    emptyStreak: longestEmptyStreak(month, publishDates),
  };
}
export type NewsSummary = Awaited<ReturnType<typeof getNewsSummary>>;

// ───────────────────────────── YouTube ─────────────────────────────

export async function getYoutubeSummary(month: string) {
  const [videos, metrics, daily, logs, quotas, manual, imports, reviewItems] = await Promise.all([
    prisma.ytVideo.findMany({ where: { month }, orderBy: { views: "desc" } }),
    prisma.metric.findMany({ where: { month, channel: "youtube" } }),
    prisma.ytDaily.findMany({ where: { month }, orderBy: { date: "asc" } }),
    prisma.ytLog.findMany({ where: { month }, orderBy: { date: "asc" } }),
    getQuotas(month),
    manualFor(month, "youtube"),
    prisma.import.findMany({ where: { month, source: { startsWith: "yt" } } }),
    // video Review/Approved per akhir bulan dari Gantt Calendar Timeline (connector Sheets)
    prisma.breakdown.findMany({ where: { month, channel: "youtube", dimension: "yt_in_review", import: { source: "yt_review" } } }),
  ]);
  const metric = (k: string) => manual[k] ?? metrics.find((m) => m.key === k)?.value ?? null;
  const views = metric("views") ?? (videos.length ? sum(videos.map((v) => v.views)) : null);
  const watchHours = metric("watchHours") ?? (videos.length ? sum(videos.map((v) => v.watchHours)) : daily.length ? sum(daily.map((d) => d.watchHours)) : null);
  const impressions = metric("impressions") ?? (videos.length ? sum(videos.map((v) => v.impressions)) : null);
  const ctr = metric("ctr") ?? (videos.length ? safeDiv(sum(videos.map((v) => (v.ctr ?? 0) * (v.impressions ?? 0))), impressions) : null);
  const subsGained = metric("subsGained") ?? (videos.length ? sum(videos.map((v) => v.subsGained)) : null);
  const subsLost = metric("subsLost") ?? (videos.some((v) => v.subsLost != null) ? sum(videos.map((v) => v.subsLost)) : null);
  const avgViewDurationSec = metric("avgViewDurationSec") ?? (watchHours != null && views ? (watchHours * 3600) / views : null);

  const logByVideo = new Map(logs.filter((l) => l.videoId).map((l) => [l.videoId!, l]));
  const logByTitle = new Map(logs.map((l) => [l.title.trim().toLowerCase(), l]));
  const enriched = videos.map((v) => {
    const log = logByVideo.get(v.videoId) ?? logByTitle.get(v.title.trim().toLowerCase());
    return { ...v, category: log?.category ?? null, format: log?.format ?? null, shareOfViews: safeDiv(v.views, views) };
  });
  const publishedLogs = logs.filter((l) => l.status === "publish");
  const published =
    manual.published ?? (logs.length ? publishedLogs.length : videos.filter((v) => v.publishedDate?.startsWith(month)).length);
  const hasReview = manual.inReview != null || imports.some((i) => i.source === "yt_review");
  const inReview = manual.inReview ?? reviewItems.length;
  const delivered = published + inReview;

  return {
    month,
    hasData: imports.length > 0 || Object.keys(manual).length > 0,
    sources: imports.map((i) => i.source),
    views,
    watchHours,
    impressions,
    ctr,
    subsGained,
    subsLost,
    subsNet: subsGained == null ? null : subsGained - (subsLost ?? 0),
    hasSubsLost: subsLost != null,
    avgViewDurationSec,
    uniqueViewers: metric("uniqueViewers"),
    viewsPerVideo: views == null || !videos.length ? null : views / videos.length,
    published,
    /** video Review/Approved per akhir bulan (Gantt Calendar Timeline) — sudah diserahkan, belum tayang */
    inReview,
    inReviewItems: reviewItems.map((b) => b.label),
    hasReview,
    /** published + in review (definisi sama dengan News & Social) */
    delivered,
    deliveredRate: safeDiv(delivered, quotas.youtube.value),
    quota: quotas.youtube,
    /** published saja ÷ kuota (catatan QuotaHero); kuota dihitung dari deliveredRate */
    achievement: safeDiv(published, quotas.youtube.value),
    videos: enriched,
    topVideos: enriched.slice(0, 10),
    lowCtrVideos: enriched.filter((v) => v.ctr != null && v.ctr < 0.04 && (v.impressions ?? 0) >= 100),
    byCategory: groupBy(enriched.filter((v) => v.category), (v) => [v.category!], (v) => v.views),
    daily: daily.map((d) => ({ date: d.date, watchHours: d.watchHours, views: d.views })),
    logs,
  };
}
export type YoutubeSummary = Awaited<ReturnType<typeof getYoutubeSummary>>;

// ───────────────────────────── Social ─────────────────────────────

/** Kategori untuk post Meta yang tidak punya pasangan di publishing log. */
export const NOT_IN_LOG_LABEL = "(tidak tercatat di Publishing Log)";

const STOPWORDS = new Set(["yang", "dari", "dengan", "untuk", "kudus", "main", "mainkekudus", "kamu", "jangan", "sudah", "dalam", "pada", "juga", "lebih", "hanya", "bukan", "para", "atau", "akan", "this", "the"]);
const words = (s: string | null | undefined) =>
  new Set(
    (s ?? "")
      .toLowerCase()
      .replace(/#\S+/g, " ")
      .normalize("NFKD")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );

type LogRow = { id: string; date: string | null; platform: string; format: string; status: string; title: string | null; url: string | null; category: string | null };
type PostRow = { id: string; date: string; platform: string; format: string; caption: string | null; permalink: string | null };

/**
 * Cocokkan baris publishing log ke post Meta (1:1).
 * Urutan: URL sama (IG: shortcode) → skor terbaik (kemiripan judul vs caption, lalu selisih tanggal ≤3 hari),
 * dipilih global dari skor tertinggi supaya pasangan tidak saling "mencuri".
 */
export function matchLogsToPosts<P extends PostRow, L extends LogRow>(posts: P[], logs: L[]): Map<string, L> {
  const out = new Map<string, L>();
  const usedLogs = new Set<string>();
  // IG: bandingkan shortcode (log sering pakai /p/ untuk Reels yang permalink-nya /reel/; shortcode peka huruf besar/kecil)
  const clean = (u: string) => {
    const ig = u.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/i);
    return ig ? `ig:${ig[1]}` : u.trim().split("?")[0].trim().replace(/\/$/, "").toLowerCase();
  };
  for (const p of posts) {
    const l = logs.find((x) => !usedLogs.has(x.id) && x.url && p.permalink && clean(x.url) === clean(p.permalink));
    if (l) {
      out.set(p.id, l);
      usedLogs.add(l.id);
    }
  }
  const compatible = (lf: string, pf: string) =>
    lf === pf || (["feeds", "carousel", "photo"].includes(lf) && ["feeds", "carousel", "photo"].includes(pf)) || (["reels", "shorts", "video"].includes(lf) && ["reels", "video"].includes(pf));
  const cands: { post: P; log: L; score: number }[] = [];
  for (const p of posts) {
    if (out.has(p.id)) continue;
    const pw = words(p.caption);
    for (const l of logs) {
      if (usedLogs.has(l.id) || l.status !== "publish" || !l.date) continue;
      if (!l.platform.split(",").includes(p.platform) || !compatible(l.format, p.format)) continue;
      const diff = Math.abs(Date.parse(l.date) - Date.parse(p.date)) / 86400000;
      if (diff > 3) continue;
      const overlap = [...words(l.title)].filter((w) => pw.has(w)).length;
      cands.push({ post: p, log: l, score: overlap * 10 - diff });
    }
  }
  // tanpa kata yang sama, hanya terima jika tanggalnya persis sama
  for (const c of maxMatching(cands.filter((c) => c.score >= 0))) out.set(c.post.id, c.log);
  return out;
}

/**
 * Pasangan sebanyak mungkin, lalu total skor tertinggi (successive shortest path / min-cost matching).
 * Greedy skor tertinggi bisa memakai 1 pasangan (log A→post B) sehingga 2 pasangan valid hilang (A↔A & B↔B).
 */
function maxMatching<E extends { post: { id: string }; log: { id: string }; score: number }>(edges: E[]): E[] {
  const byPost = new Map<string, E>();
  const byLog = new Map<string, E>();
  const posts = [...new Set(edges.map((e) => e.post.id))];
  for (;;) {
    // Bellman-Ford di graf residual: post→log (belum dipasang) biaya -skor, log→post (sudah dipasang) biaya +skor
    const dist = new Map<string, number>();
    const via = new Map<string, E>();
    for (const p of posts) if (!byPost.has(p)) dist.set(`p:${p}`, 0);
    for (let changed = true, i = 0; changed && i <= 2 * edges.length; i++) {
      changed = false;
      for (const e of edges) {
        const [from, to, cost] = byPost.get(e.post.id) === e ? [`l:${e.log.id}`, `p:${e.post.id}`, e.score] : [`p:${e.post.id}`, `l:${e.log.id}`, -e.score];
        const d = dist.get(from);
        if (d != null && d + cost < (dist.get(to) ?? Infinity)) {
          dist.set(to, d + cost);
          via.set(to, e);
          changed = true;
        }
      }
    }
    let end: string | null = null;
    for (const e of edges) {
      const k = `l:${e.log.id}`;
      if (!byLog.has(e.log.id) && dist.has(k) && (end == null || dist.get(k)! < dist.get(end)!)) end = k;
    }
    if (!end) return [...byPost.values()];
    // balik jalur dari log bebas: edge maju jadi pasangan; post-nya melepas pasangan lama (via[post]) ke log sebelumnya
    for (let node: string | null = end; node; ) {
      const e = via.get(node)!;
      const prev = via.get(`p:${e.post.id}`);
      byPost.set(e.post.id, e);
      byLog.set(e.log.id, e);
      node = prev ? `l:${prev.log.id}` : null;
    }
  }
}

/** Format dalam istilah Instagram: video apa pun tayang sebagai Reels, carousel/foto = Feeds. */
const igFormat = (f: string) => (["reels", "video", "shorts"].includes(f) ? "reels" : ["feeds", "carousel", "photo"].includes(f) ? "feeds" : f);
const onInstagram = (l: LogRow) => l.platform.split(",").includes("instagram");

/**
 * Cek konsistensi Publishing Log vs post Instagram dari API (hanya log berstatus publish, tanpa Stories —
 * API tidak memberi Stories lama). Semua daftar berisi baris log / post asli untuk ditindaklanjuti.
 */
export function reconcileSocial<P extends PostRow, L extends LogRow>(posts: P[], logs: L[], matched: Map<string, L>) {
  const content = logs.filter((l) => l.status === "publish" && l.format !== "story");
  const igLogs = content.filter(onInstagram);
  const matchedLogIds = new Set([...matched.values()].map((l) => l.id));
  const pairs = posts.flatMap((p) => (matched.has(p.id) ? [{ post: p, log: matched.get(p.id)! }] : []));

  // Log & post sama-sama tanpa pasangan, tanggal ±1 hari, judul mirip (atau tanggal sama) → kemungkinan format di log salah
  let freePosts = posts.filter((p) => !matched.has(p.id));
  let freeLogs = igLogs.filter((l) => !matchedLogIds.has(l.id));
  const formatMismatch = pairs.filter((x) => igFormat(x.log.format) !== igFormat(x.post.format));
  for (const l of [...freeLogs]) {
    const best = freePosts
      .map((p) => ({ p, diff: l.date ? Math.abs(Date.parse(l.date) - Date.parse(p.date)) / 86400000 : Infinity, overlap: [...words(l.title)].filter((w) => words(p.caption).has(w)).length }))
      .filter((x) => x.diff <= 1 && (x.overlap > 0 || x.diff === 0))
      .sort((a, b) => b.overlap - a.overlap || a.diff - b.diff)[0];
    if (!best) continue;
    formatMismatch.push({ post: best.p, log: l });
    freePosts = freePosts.filter((p) => p !== best.p);
    freeLogs = freeLogs.filter((x) => x !== l);
  }

  // Ringkasan per format IG: log (platform termasuk IG) vs API
  const byFormat = ["reels", "feeds"].map((f) => {
    const logRows = igLogs.filter((l) => igFormat(l.format) === f);
    const detail = Object.entries(logRows.reduce<Record<string, number>>((a, l) => ((a[l.format] = (a[l.format] ?? 0) + 1), a), {})).map(([format, count]) => ({ format, count }));
    const log = logRows.length;
    const api = posts.filter((p) => igFormat(p.format) === f).length;
    return { format: f, log, api, diff: api - log, detail };
  });

  const titleKey = (l: L) => `${l.date}|${l.format}|${(l.title ?? "").trim().toLowerCase()}`;
  const groups = new Map<string, L[]>();
  for (const l of content) groups.set(titleKey(l), [...(groups.get(titleKey(l)) ?? []), l]);

  return {
    byFormat,
    /** post IG tanpa baris log */
    notInLog: freePosts,
    /** baris log berplatform IG yang tidak ditemukan di IG */
    logNotOnIg: freeLogs,
    /** log & post kemungkinan konten yang sama tapi format berbeda (Feeds vs Reels) */
    formatMismatch,
    /** Video di log yang tayang sebagai Reels di IG — wajar, hanya info */
    videoAsReels: pairs.filter((x) => ["video", "shorts"].includes(x.log.format) && x.post.format === "reels"),
    /** konten di log yang tidak diposting ke IG (TikTok/YouTube saja) — tetap dihitung ke kuota */
    offInstagram: content.filter((l) => !onInstagram(l)),
    /** baris log kembar: tanggal, format & judul sama */
    duplicates: [...groups.values()].filter((g) => g.length > 1 && g[0].title),
    /** baris log IG tanpa URL (dicocokkan lewat judul + tanggal) */
    missingUrl: igLogs.filter((l) => !l.url).length,
  };
}
export type SocialRecon = ReturnType<typeof reconcileSocial>;

/**
 * Snapshot IgMediaSnapshot pertama setelah bulan selesai (maks. 7 hari) → views per media s/d akhir bulan.
 * Untuk post yang dipublish bulan itu, nilai ini = views selama bulan itu dan tidak berubah saat sync ulang.
 */
async function monthEndSnapshot(month: string) {
  const start = `${addMonths(month, 1)}-01`;
  const limit = new Date(Date.parse(`${start}T00:00:00Z`) + 7 * 86400_000).toISOString().slice(0, 10);
  const first = await prisma.igMediaSnapshot.findFirst({ where: { date: { gte: start, lte: limit } }, orderBy: { date: "asc" }, select: { date: true } });
  if (!first) return null;
  const rows = await prisma.igMediaSnapshot.findMany({ where: { date: first.date }, select: { mediaId: true, views: true } });
  return { date: first.date, views: new Map(rows.map((r) => [r.mediaId, r.views])) };
}

/** Urutan & label jenis konten dari breakdown media_product_type insight akun IG. */
export const IG_TYPES: { type: string; label: string }[] = [
  { type: "REEL", label: "Reels" },
  { type: "CAROUSEL_CONTAINER", label: "Carousel" },
  { type: "POST", label: "Foto / lainnya" },
  { type: "STORY", label: "Story" },
];

/**
 * Views & reach selama bulan itu per jenis konten + interactions (Meta menggabungkan carousel & foto ke "POST"
 * untuk interactions). Termasuk post lama yang masih ditonton bulan itu. Null jika belum ada datanya.
 */
async function igByType(month: string) {
  const rows = await prisma.igAccountByType.findMany({ where: { month } });
  if (!rows.length) return null;
  const val = (metric: string, type: string) => rows.find((r) => r.metric === metric && r.type === type)?.value ?? null;
  const known = new Set(IG_TYPES.map((t) => t.type));
  const types = [...IG_TYPES, ...[...new Set(rows.map((r) => r.type))].filter((t) => !known.has(t)).map((t) => ({ type: t, label: t }))];
  const totalViews = sum(rows.filter((r) => r.metric === "views").map((r) => r.value));
  return {
    rows: types
      .map((t) => ({ ...t, views: val("views", t.type), reach: val("reach", t.type), share: safeDiv(val("views", t.type), totalViews) }))
      .filter((t) => t.views != null || t.reach != null),
    totalViews,
    interactions: { reels: val("total_interactions", "REEL"), feeds: val("total_interactions", "POST"), story: val("total_interactions", "STORY") },
  };
}

/**
 * Story IG yang tayang bulan itu (tabel IgStory: CSV Business Suite / API selagi aktif). Hanya info — termasuk
 * repost & tiap frame, jadi tidak dibandingkan sebagai selisih. `since`: Story sebelum tanggal ini belum tercatat
 * (API baru mulai mengumpulkan dan tidak ada CSV yang menutup celahnya).
 */
async function storiesInfo(month: string, logCount: number) {
  const [rows, firstApi] = await Promise.all([
    prisma.igStory.findMany({ where: { month }, select: { date: true, source: true } }),
    prisma.igStory.findFirst({ where: { source: "api" }, orderBy: { date: "asc" }, select: { date: true } }),
  ]);
  if (!rows.length) return null;
  const csvLast = rows.filter((r) => r.source === "csv").reduce<string | null>((a, r) => (a && a > r.date ? a : r.date), null);
  const apiStart = firstApi && firstApi.date > `${month}-01` && firstApi.date.startsWith(month) ? firstApi.date : null;
  const dayBefore = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10);
  const since = apiStart && (!csvLast || csvLast < dayBefore(apiStart)) ? apiStart : null;
  return { ig: rows.length, log: logCount, share: safeDiv(logCount, rows.length), since, sources: [...new Set(rows.map((r) => r.source))] };
}

/** Akun milik MKK per platform: dari OWN_SOCIAL_ACCOUNTS, atau akun terbanyak jika tidak ada yang cocok. */
function ownAccounts(posts: { platform: string; account: string | null }[]): Set<string> {
  const out = new Set<string>();
  for (const platform of new Set(posts.map((p) => p.platform))) {
    const counts = new Map<string, number>();
    for (const p of posts) if (p.platform === platform && p.account) counts.set(p.account, (counts.get(p.account) ?? 0) + 1);
    const configured = [...counts.keys()].filter((a) => OWN_SOCIAL_ACCOUNTS.includes(a));
    const chosen = configured.length ? configured : [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1).map(([a]) => a);
    for (const a of chosen) out.add(`${platform}:${a}`);
  }
  return out;
}

export async function getSocialSummary(month: string) {
  const [allPosts, logs, quotas, manual, imports, accountMetrics, reviewImport, reviewItems] = await Promise.all([
    // hanya platform aktif (lib/sources.ts) yang dihitung ke performa
    prisma.socialPost.findMany({ where: { month, platform: { in: ACTIVE_SOCIAL_PLATFORMS } }, orderBy: { publishedAt: "asc" } }),
    prisma.socialLog.findMany({ where: { month }, orderBy: { date: "asc" } }),
    getQuotas(month),
    manualFor(month, "social"),
    prisma.import.findMany({ where: { month, OR: [{ source: { startsWith: "meta" } }, { source: "social_log" }] } }),
    // insight akun IG selama bulan itu (connector Meta); kosong untuk bulan hasil import CSV
    ACTIVE_SOCIAL_PLATFORMS.includes("instagram")
      ? prisma.metric.findMany({ where: { month, channel: "social", key: { startsWith: "ig_account_" }, import: { source: "meta_instagram" } } })
      : [],
    prisma.import.findUnique({ where: { month_source: { month, source: "social_review" } } }),
    // konten "Reviewing" dari tracker Task Progress (connector Sheets); kosong = tracker belum di-sync bulan ini
    prisma.breakdown.findMany({ where: { month, channel: "social", dimension: "social_in_review", import: { source: "social_review" } } }),
  ]);
  const account = (k: string) => accountMetrics.find((m) => m.key === `ig_account_${k}`)?.value ?? null;

  // Hanya post milik akun MKK yang dihitung; kolaborasi/repost dari akun lain dipisah.
  const own = ownAccounts(allPosts);
  const posts = allPosts.filter((p) => !p.account || own.has(`${p.platform}:${p.account}`));
  const collabPosts = allPosts.filter((p) => !posts.includes(p)).map((p) => ({ ...p, er: safeDiv(p.interactions, p.reach) }));

  const matched = matchLogsToPosts(posts, logs);
  const monthSnap = await monthEndSnapshot(month);
  const enriched = posts.map((p) => {
    const log = matched.get(p.id);
    // views s/d akhir bulan (snapshot pertama setelah bulan selesai; post dipublish bulan ini → mulai dari 0)
    const monthViews = monthSnap ? (monthSnap.views.get(p.postId) ?? null) : null;
    // Format bisnis dari publishing log (Reels berbayar ≠ Video upload, walau di IG sama-sama "reels");
    // post yang tidak di log: istilah Meta, carousel/foto disamakan dengan "feeds" milik log.
    const format = log?.format ?? (logs.length && ["carousel", "photo"].includes(p.format) ? "feeds" : p.format);
    return { ...p, format, metaFormat: p.format, monthViews, category: log?.category ?? null, title: log?.title ?? null, inLog: !!log, er: safeDiv(p.interactions, p.reach) };
  });

  // Views, reach & interactions: insight akun selama bulan itu (API) jika ada — termasuk post lama & Stories.
  // Bulan hasil import CSV: jumlah metrik lifetime per post yang dipublish bulan itu.
  const metricsSource: "account" | "posts" = account("views") != null ? "account" : "posts";
  const postViews = posts.length ? sum(posts.map((p) => p.views)) : null;
  const reach = manual.reach ?? (metricsSource === "account" ? account("reach") : posts.length ? sum(posts.map((p) => p.reach)) : null);
  const views = manual.views ?? (metricsSource === "account" ? account("views") : postViews);
  const interactions = manual.interactions ?? (metricsSource === "account" ? account("total_interactions") : posts.length ? sum(posts.map((p) => p.interactions)) : null);
  // Follows: follow baru ke akun IG dari insight akun (API). Fallback bulan lama (import CSV): jumlah follows per post.
  const followsSource: "manual" | "account" | "posts" | null =
    manual.follows != null ? "manual" : account("follows") != null ? "account" : posts.some((p) => p.follows != null) ? "posts" : null;
  const follows =
    followsSource === "manual" ? manual.follows : followsSource === "account" ? account("follows") : followsSource === "posts" ? sum(posts.map((p) => p.follows)) : null;
  const publishedLogs = logs.filter((l) => l.status === "publish");
  const countSource: "log" | "meta" = logs.length ? "log" : "meta";
  // Satu baris publishing log = satu konten (walau diposting ke beberapa channel)
  const units = countSource === "log" ? publishedLogs.map((l) => ({ platform: l.platform, format: l.format, date: l.date })) : posts.map((p) => ({ platform: p.platform, format: p.format, date: p.date as string | null }));
  const postsPublished = manual.posts ?? units.length;
  const publishedByFormat = Object.entries(
    units.reduce<Record<string, number>>((a, u) => ((a[u.format] = (a[u.format] ?? 0) + 1), a), {}),
  )
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count);

  const hasReview = manual.inReview != null || !!reviewImport;
  const inReview = manual.inReview ?? reviewItems.length;
  // Kuota sosmed: satu angka untuk semua format (Publishing Log = sumber resmi). Delivered = published + in review
  // (snapshot akhir bulan dari Task Progress), sama dengan definisi News & YouTube.
  const quotaProgress = [{ quota: quotas.social, count: postsPublished + inReview }].map((q) => ({
    ...q,
    published: postsPublished,
    inReview,
    rate: safeDiv(q.count, q.quota.value),
    publishedRate: safeDiv(postsPublished, q.quota.value),
    available: units.length > 0 || manual.posts != null,
  }));

  const activeDates = new Set(units.map((u) => u.date).filter((d): d is string => !!d));

  type Agg = { label: string; platform: string; format: string; posts: number; reach: number; views: number; interactions: number };
  const aggregate = (keyOf: (p: (typeof enriched)[number]) => { label: string; platform: string; format: string }) => {
    const map = new Map<string, Agg>();
    for (const p of enriched) {
      const k = keyOf(p);
      const a = map.get(k.label) ?? { ...k, posts: 0, reach: 0, views: 0, interactions: 0 };
      a.posts++;
      a.reach += p.reach ?? 0;
      a.views += p.views ?? 0;
      a.interactions += p.interactions ?? 0;
      map.set(k.label, a);
    }
    return [...map.values()]
      .map((a) => ({ ...a, avgReach: safeDiv(a.reach, a.posts), avgViews: safeDiv(a.views, a.posts), er: safeDiv(a.interactions, a.reach) }))
      .sort((a, b) => b.reach - a.reach);
  };

  const byPlatform = aggregate((p) => ({ label: p.platform, platform: p.platform, format: "" }));
  const byFormat = aggregate((p) => ({ label: `${p.platform}:${p.format}`, platform: p.platform, format: p.format }));
  const byCategory = aggregate((p) => ({ label: p.category ?? NOT_IN_LOG_LABEL, platform: "", format: "" }));

  const daily = daysInMonth(month).map((d) => {
    const dayPosts = enriched.filter((p) => p.date === d);
    return { date: d, posts: units.filter((u) => u.date === d).length, reach: sum(dayPosts.map((p) => p.reach)) };
  });

  return {
    month,
    hasData: imports.length > 0 || Object.keys(manual).length > 0,
    hasLog: logs.length > 0,
    sources: imports.map((i) => i.source),
    platforms: [...new Set(posts.map((p) => p.platform))],
    posts: enriched,
    postsPublished,
    /** konten yang diserahkan bulan ini & belum tayang per akhir bulan (Task Progress) */
    inReview,
    inReviewItems: reviewItems.map((b) => b.label),
    /** false = tracker belum di-sync untuk bulan ini (in review dianggap 0) */
    hasReview,
    countSource,
    reach,
    views,
    interactions,
    /** asal views/reach/interactions: insight akun selama bulan itu (API) atau jumlah lifetime per post (CSV lama) */
    metricsSource,
    /** jumlah views lifetime post yang dipublish bulan ini (untuk rata-rata per post) */
    postViews,
    follows,
    /** asal angka follows: insight akun (API), jumlah per post (export CSV lama), atau input manual */
    followsSource,
    engagementRate: safeDiv(interactions, reach),
    quotaProgress,
    publishedByFormat,
    /** post di export Meta yang tidak tercatat di publishing log (hanya relevan jika log ada) */
    postsNotInLog: logs.length ? enriched.filter((p) => !p.inLog) : [],
    /** cek konsistensi Publishing Log vs Instagram API (null jika log belum ada) */
    recon: logs.length && posts.length ? reconcileSocial(posts, logs, matched) : null,
    /** Story IG yang tayang (termasuk repost) vs Story di log — hanya info, bukan KPI */
    stories: await storiesInfo(month, publishedLogs.filter((l) => l.format === "story").length),
    /** tanggal acuan metrik lifetime per post (waktu sync/import post IG bulan itu) */
    postsAsOf: imports.find((i) => i.source === "meta_instagram")?.createdAt ?? null,
    /** tanggal snapshot yang dipakai untuk "views bulan ini" per post (null = belum ada snapshot setelah bulan selesai) */
    monthViewsAsOf: monthSnap?.date ?? null,
    /** insight akun selama bulan itu per jenis konten (per periode, stabil saat sync ulang) */
    byType: await igByType(month),
    /** post kolaborasi/repost milik akun lain — tidak dihitung ke performa maupun kuota */
    collabPosts,
    activeDays: activeDates.size,
    emptyStreak: longestEmptyStreak(month, activeDates),
    byPlatform,
    byFormat,
    byCategory: logs.length ? byCategory : [],
    topPosts: [...enriched].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0)).slice(0, 10),
    daily,
    logs,
  };
}
export type SocialSummary = Awaited<ReturnType<typeof getSocialSummary>>;

// ───────────────────────────── Gabungan ─────────────────────────────

export async function getMonthBundle(month: string) {
  const [website, news, youtube, social] = await Promise.all([
    getWebsiteSummary(month),
    getNewsSummary(month),
    getYoutubeSummary(month),
    getSocialSummary(month),
  ]);
  return { month, website, news, youtube, social };
}
export type MonthBundle = Awaited<ReturnType<typeof getMonthBundle>>;

export interface QuotaSummary {
  channel: "news" | "youtube" | "social";
  label: string;
  unit: string;
  published: number;
  /** jumlah yang dihitung ke kuota (News: published + in review = delivered) */
  achieved: number;
  achievedLabel: string;
  target: number;
  /** achieved ÷ target */
  rate: number | null;
  /** bagian-bagian bar bertumpuk (mis. Published + In review); kosong = bar tunggal */
  segments: { label: string; count: number; color: string }[];
  /** false jika belum ada data yang bisa dinilai untuk bulan ini */
  available: boolean;
  /** rincian; target null = hanya jumlah (tanpa target per item) */
  breakdown: { label: string; count: number; target: number | null; rate: number | null }[];
  note?: string;
  source?: string;
}

/** Kuota tercapai per channel konten, dalam bentuk yang sama untuk semua halaman. */
export function contentQuota(b: MonthBundle, channel: QuotaSummary["channel"]): QuotaSummary {
  if (channel === "news") {
    const n = b.news;
    return {
      channel,
      label: "Artikel",
      unit: "artikel",
      published: n.published,
      // yang sudah diserahkan = publish + review
      achieved: n.delivered,
      achievedLabel: "Delivered",
      target: n.quota.value,
      rate: n.hasData ? n.achievement : null,
      segments: [
        { label: "Published", count: n.published, color: "var(--chart-1)" },
        { label: "In review", count: n.inReview, color: "var(--chart-2)" },
      ],
      available: n.hasData,
      breakdown: [],
      note: n.hasData ? `Published saja: ${fmtNum(n.published)} / ${fmtNum(n.quota.value)} (${fmtPct(n.publishedRate)})` : undefined,
      source: "Dari News Content Logs (status Publish + Review)",
    };
  }
  if (channel === "youtube") {
    const y = b.youtube;
    return {
      channel,
      label: "Video YouTube",
      unit: "video",
      published: y.published,
      // yang sudah diserahkan = publish + Review/Approved di Gantt per akhir bulan
      achieved: y.delivered,
      achievedLabel: "Delivered",
      target: y.quota.value,
      rate: y.hasData ? y.deliveredRate : null,
      segments: [
        { label: "Published", count: y.published, color: "var(--chart-1)" },
        { label: "In review", count: y.inReview, color: "var(--chart-2)" },
      ],
      available: y.hasData,
      breakdown: [],
      note: y.hasData
        ? y.hasReview
          ? `Published saja: ${fmtNum(y.published)} / ${fmtNum(y.quota.value)} (${fmtPct(y.achievement)})`
          : "Gantt Calendar Timeline belum di-sync bulan ini — in review dianggap 0"
        : undefined,
      source: `${y.logs.length ? "Published dari Youtube Calendar Timeline (Summary)" : "Published dari tanggal publish video"} · in review = Review/Approved di Gantt per akhir bulan`,
    };
  }
  const s = b.social;
  const q = s.quotaProgress[0];
  const notInLog = s.postsNotInLog.length;
  const notes = [
    s.hasReview ? `Published saja: ${fmtNum(q.published)} / ${fmtNum(q.quota.value)} (${fmtPct(q.publishedRate)})` : "Tracker Task Progress belum di-sync bulan ini — in review dianggap 0",
    s.countSource === "log"
      ? notInLog
        ? `${notInLog} post akun MKK tidak tercatat di Publishing Log (tidak dihitung ke kuota)`
        : null
      : "Stories tidak ada di export Meta — import Publishing Log untuk angka resmi",
  ].filter(Boolean);
  return {
    channel,
    label: "Post sosmed",
    unit: "post",
    published: q.published,
    // yang sudah diserahkan = publish (Publishing Log) + in review (Task Progress, snapshot akhir bulan)
    achieved: q.count,
    achievedLabel: "Delivered",
    target: q.quota.value,
    rate: q.available ? q.rate : null,
    segments: [
      { label: "Published", count: q.published, color: "var(--chart-1)" },
      { label: "In review", count: q.inReview, color: "var(--chart-2)" },
    ],
    available: q.available,
    breakdown: s.publishedByFormat.map((f) => ({ label: FORMAT_LABEL[f.format] ?? f.format, count: f.count, target: null, rate: null })),
    note: notes.join(" · ") || undefined,
    source: `${s.countSource === "log" ? "Published dari Publishing Log (1 baris = 1 post)" : "Published dari export Meta"} · in review = diserahkan bulan ini, belum tayang per akhir bulan (Task Progress)`,
  };
}

/**
 * Angka sosmed yang bisa dibandingkan antar bulan: hanya platform yang ada di kedua bulan
 * (mis. Agustus cuma IG dan September cuma FB → tidak ada pembanding).
 */
export function socialComparable(cur: SocialSummary, prev: SocialSummary | null) {
  if (!prev?.hasData || !cur.hasData) return null;
  const common = cur.platforms.filter((p) => prev.platforms.includes(p));
  if (!common.length) return null;
  // insight akun (selama bulan) vs jumlah lifetime per post: definisi beda → tidak dibandingkan
  const sameSource = cur.metricsSource === prev.metricsSource;
  const pick = (s: SocialSummary) => {
    const rows = s.byPlatform.filter((b) => common.includes(b.platform));
    const posts = s.posts.filter((p) => common.includes(p.platform));
    const account = s.metricsSource === "account";
    const reach = !sameSource ? null : account ? s.reach : sum(rows.map((r) => r.reach));
    const interactions = !sameSource ? null : account ? s.interactions : sum(rows.map((r) => r.interactions));
    return {
      posts: posts.length,
      reach,
      views: !sameSource ? null : account ? s.views : sum(rows.map((r) => r.views)),
      postViews: sum(posts.map((p) => p.views)),
      interactions,
      // follows per bulan hanya sebanding jika definisinya sama (insight akun vs jumlah per post)
      follows: cur.followsSource === prev.followsSource ? s.follows : null,
      engagementRate: reach == null || interactions == null ? null : safeDiv(interactions, reach),
    };
  };
  const partial = common.length < cur.platforms.length || common.length < prev.platforms.length;
  return { platforms: common, partial, cur: pick(cur), prev: pick(prev) };
}

/**
 * Sumber kartu KPI Social (dashboard & laporan, SOCIAL_KPIS): nilai bulan ini lengkap; bulan lalu hanya metrik yang
 * sebanding (aturan socialComparable — platform sama & definisi sama), selain itu null → tidak dibandingkan.
 */
export function socialKpiSources(cur: SocialSummary, prev: SocialSummary | null) {
  const cmp = socialComparable(cur, prev);
  const per = (v: number | null | undefined, n: number) => (v == null || !n ? null : v / n);
  const src = (s: SocialSummary) => ({
    published: s.postsPublished,
    delivered: s.quotaProgress[0].count,
    quota: s.quotaProgress[0].quota,
    views: s.views,
    viewsPerPost: per(s.postViews, s.posts.length),
    reach: s.reach,
    engagementRate: s.engagementRate,
    interactions: s.interactions,
    follows: s.follows,
    activeDays: s.activeDays,
  });
  const prevSrc = !prev?.hasData
    ? null
    : {
        ...src(prev),
        views: cmp?.prev.views ?? null,
        viewsPerPost: cmp ? per(cmp.prev.postViews, cmp.prev.posts) : null,
        reach: cmp?.prev.reach ?? null,
        engagementRate: cmp?.prev.engagementRate ?? null,
        interactions: cmp?.prev.interactions ?? null,
        follows: cmp?.prev.follows ?? null,
      };
  return { cur: src(cur), prev: prevSrc, cmp };
}

/** KPI lintas channel untuk Overview. */
export function overviewKpis(b: MonthBundle) {
  const parts = [b.website.gscImpressions, b.youtube.impressions, b.social.reach];
  const engParts = [b.social.interactions, b.website.engagedSessions];
  return {
    totalReach: parts.every((p) => p == null) ? null : sum(parts),
    totalEngagement: engParts.every((p) => p == null) ? null : sum(engParts),
    websiteUsers: b.website.users,
    youtubeViews: b.youtube.hasData ? b.youtube.views : null,
    articlesPublished: b.news.hasData ? b.news.published : null,
    postsPublished: b.social.hasData ? b.social.postsPublished : null,
  };
}

/**
 * Nilai pembanding MoM untuk KPI overview. KPI gabungan hanya memakai komponen yang
 * ada di kedua bulan; null = tidak ada pembanding yang adil.
 */
export function overviewComparison(cur: MonthBundle, prev: MonthBundle) {
  const soc = socialComparable(cur.social, prev.social);
  const pair = (a: number | null, b: number | null) => (a != null && b != null ? ([a, b] as const) : null);
  type Pair = readonly [number, number] | null;
  /** components: [nilai bulan ini, pasangan pembanding]; partial jika ada komponen tanpa pembanding */
  const composite = (components: [number | null, Pair][]) => {
    const ok = components.map((c) => c[1]).filter((p): p is readonly [number, number] => !!p);
    if (!ok.length) return null;
    return { cur: sum(ok.map((p) => p[0])), prev: sum(ok.map((p) => p[1])), partial: components.some((c) => c[0] != null && !c[1]) };
  };
  const ytImpr = cur.youtube.hasData ? cur.youtube.impressions : null;
  return {
    totalReach: composite([
      [cur.website.gscImpressions, pair(cur.website.gscImpressions, prev.website.gscImpressions)],
      [ytImpr, pair(ytImpr, prev.youtube.hasData ? prev.youtube.impressions : null)],
      [cur.social.reach, soc ? pair(soc.cur.reach, soc.prev.reach) : null],
    ]),
    totalEngagement: composite([
      [cur.social.interactions, soc ? pair(soc.cur.interactions, soc.prev.interactions) : null],
      [cur.website.engagedSessions, pair(cur.website.engagedSessions, prev.website.engagedSessions)],
    ]),
    websiteUsers: pair(cur.website.users, prev.website.users),
    youtubeViews: pair(cur.youtube.hasData ? cur.youtube.views : null, prev.youtube.hasData ? prev.youtube.views : null),
    articlesPublished: pair(cur.news.hasData ? cur.news.published : null, prev.news.hasData ? prev.news.published : null),
    postsPublished: soc ? ([soc.cur.posts, soc.prev.posts] as const) : null,
  };
}

export async function getMonthsWithData(): Promise<string[]> {
  const [imports, manual] = await Promise.all([
    prisma.import.findMany({ distinct: ["month"], select: { month: true } }),
    prisma.manualMetric.findMany({ distinct: ["month"], select: { month: true } }),
  ]);
  return [...new Set([...imports, ...manual].map((r) => r.month))].sort();
}

/** Bulan dari query string, atau bulan terakhir yang ada datanya. */
export async function resolveMonth(param: string | string[] | undefined): Promise<{ month: string; months: string[] }> {
  const months = await getMonthsWithData();
  const p = Array.isArray(param) ? param[0] : param;
  if (p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return { month: p, months };
  const fallback = months.at(-1) ?? new Date().toISOString().slice(0, 7);
  return { month: fallback, months };
}

export async function getTrend(month: string, n = 6) {
  const months = lastMonths(month, n);
  const bundles = await Promise.all(months.map((m) => getMonthBundle(m)));
  return bundles.map((b) => ({
    month: b.month,
    websiteUsers: b.website.users,
    websiteSessions: b.website.sessions,
    pageviews: b.website.pageviews,
    engagementRate: b.website.engagementRate,
    gscClicks: b.website.gscClicks,
    gscImpressions: b.website.gscImpressions,
    newsPublished: b.news.hasData ? b.news.published : null,
    newsQuota: b.news.quota.value,
    newsDelivered: b.news.hasData ? b.news.delivered : null,
    newsViews: b.news.hasData ? b.news.totalViews : null,
    ytPublished: b.youtube.hasData ? b.youtube.published : null,
    ytQuota: b.youtube.quota.value,
    ytDelivered: b.youtube.hasData ? b.youtube.delivered : null,
    ytViews: b.youtube.hasData ? b.youtube.views : null,
    ytWatchHours: b.youtube.hasData ? b.youtube.watchHours : null,
    ytImpressions: b.youtube.hasData ? b.youtube.impressions : null,
    socialReach: b.social.hasData ? b.social.reach : null,
    // per platform supaya bulan IG vs bulan FB tidak terbaca sebagai naik/turun
    reachInstagram: b.social.byPlatform.find((p) => p.platform === "instagram")?.reach ?? null,
    reachFacebook: b.social.byPlatform.find((p) => p.platform === "facebook")?.reach ?? null,
    socialInteractions: b.social.hasData ? b.social.interactions : null,
    socialPosts: b.social.hasData ? b.social.postsPublished : null,
    socialQuotaCount: b.social.hasData ? contentQuota(b, "social").published : null,
    socialDelivered: b.social.hasData ? contentQuota(b, "social").achieved : null,
    socialQuota: contentQuota(b, "social").target,
    socialViews: b.social.hasData ? b.social.views : null,
    viewsInstagram: b.social.byPlatform.find((p) => p.platform === "instagram")?.views ?? null,
    viewsFacebook: b.social.byPlatform.find((p) => p.platform === "facebook")?.views ?? null,
    socialEr: b.social.engagementRate,
  }));
}
export type TrendPoint = Awaited<ReturnType<typeof getTrend>>[number];

export async function getMonthAndPrev(month: string) {
  const [cur, prev] = await Promise.all([getMonthBundle(month), getMonthBundle(prevMonth(month))]);
  return { cur, prev };
}

export type { QuotaValue };
