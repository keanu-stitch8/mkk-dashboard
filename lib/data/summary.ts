// Ringkasan metrik per channel per bulan, dihitung dari tabel detail + total import + input manual.
import { prisma } from "../db";
import { daysInMonth, lastMonths, prevMonth } from "../month";
import { getQuotas, type QuotaValue } from "./quota";
import { FORMAT_LABEL, OWN_SOCIAL_ACCOUNTS } from "../sources";
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

  let gscClicks: number | null = gscDaily.length ? sum(gscDaily.map((d) => d.clicks)) : null;
  let gscImpressions: number | null = gscDaily.length ? sum(gscDaily.map((d) => d.impressions)) : null;
  let gscPosition: number | null = gscDaily.length ? safeDiv(sum(gscDaily.map((d) => d.position * d.impressions)), gscImpressions) : null;

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
  const [videos, metrics, daily, logs, quotas, manual, imports] = await Promise.all([
    prisma.ytVideo.findMany({ where: { month }, orderBy: { views: "desc" } }),
    prisma.metric.findMany({ where: { month, channel: "youtube" } }),
    prisma.ytDaily.findMany({ where: { month }, orderBy: { date: "asc" } }),
    prisma.ytLog.findMany({ where: { month }, orderBy: { date: "asc" } }),
    getQuotas(month),
    manualFor(month, "youtube"),
    prisma.import.findMany({ where: { month, source: { startsWith: "yt" } } }),
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
    published,
    quota: quotas.youtube,
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
 * Urutan: URL sama → skor terbaik (kemiripan judul vs caption, lalu selisih tanggal ≤3 hari),
 * dipilih global dari skor tertinggi supaya pasangan tidak saling "mencuri".
 */
export function matchLogsToPosts<P extends PostRow, L extends LogRow>(posts: P[], logs: L[]): Map<string, L> {
  const out = new Map<string, L>();
  const usedLogs = new Set<string>();
  const clean = (u: string) => u.split("?")[0].replace(/\/$/, "").toLowerCase();
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
  cands.sort((a, b) => b.score - a.score);
  for (const c of cands) {
    if (out.has(c.post.id) || usedLogs.has(c.log.id)) continue;
    // tanpa kata yang sama, hanya terima jika tanggalnya persis sama
    if (c.score < 0) continue;
    out.set(c.post.id, c.log);
    usedLogs.add(c.log.id);
  }
  return out;
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
  const [allPosts, logs, quotas, manual, imports] = await Promise.all([
    prisma.socialPost.findMany({ where: { month }, orderBy: { publishedAt: "asc" } }),
    prisma.socialLog.findMany({ where: { month }, orderBy: { date: "asc" } }),
    getQuotas(month),
    manualFor(month, "social"),
    prisma.import.findMany({ where: { month, OR: [{ source: { startsWith: "meta" } }, { source: "social_log" }] } }),
  ]);

  // Hanya post milik akun MKK yang dihitung; kolaborasi/repost dari akun lain dipisah.
  const own = ownAccounts(allPosts);
  const posts = allPosts.filter((p) => !p.account || own.has(`${p.platform}:${p.account}`));
  const collabPosts = allPosts.filter((p) => !posts.includes(p)).map((p) => ({ ...p, er: safeDiv(p.interactions, p.reach) }));

  const matched = matchLogsToPosts(posts, logs);
  const enriched = posts.map((p) => {
    const log = matched.get(p.id);
    return { ...p, category: log?.category ?? null, inLog: !!log, er: safeDiv(p.interactions, p.reach) };
  });

  const reach = manual.reach ?? (posts.length ? sum(posts.map((p) => p.reach)) : null);
  const views = manual.views ?? (posts.length ? sum(posts.map((p) => p.views)) : null);
  const interactions = manual.interactions ?? (posts.length ? sum(posts.map((p) => p.interactions)) : null);
  const follows = manual.follows ?? (posts.some((p) => p.follows != null) ? sum(posts.map((p) => p.follows)) : null);
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

  // Kuota sosmed: satu angka untuk semua format (sama dengan report: Publishing Log = sumber resmi)
  const quotaProgress = [{ quota: quotas.social, count: postsPublished }].map((q) => ({
    ...q,
    rate: safeDiv(q.count, q.quota.value),
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
    countSource,
    reach,
    views,
    interactions,
    follows,
    engagementRate: safeDiv(interactions, reach),
    quotaProgress,
    publishedByFormat,
    /** post di export Meta yang tidak tercatat di publishing log (hanya relevan jika log ada) */
    postsNotInLog: logs.length ? enriched.filter((p) => !p.inLog) : [],
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
      achieved: y.published,
      achievedLabel: "Published",
      target: y.quota.value,
      rate: y.hasData ? y.achievement : null,
      segments: [],
      available: y.hasData,
      breakdown: [],
      source: y.logs.length ? "Dari publishing log YouTube" : "Dari tanggal publish video",
    };
  }
  const s = b.social;
  const q = s.quotaProgress[0];
  const notInLog = s.postsNotInLog.length;
  return {
    channel,
    label: "Post sosmed",
    unit: "post",
    published: q.count,
    achieved: q.count,
    achievedLabel: "Published",
    target: q.quota.value,
    rate: q.available ? q.rate : null,
    segments: [],
    available: q.available,
    breakdown: s.publishedByFormat.map((f) => ({ label: FORMAT_LABEL[f.format] ?? f.format, count: f.count, target: null, rate: null })),
    note:
      s.countSource === "log"
        ? notInLog
          ? `${notInLog} post akun MKK tidak tercatat di Publishing Log (tidak dihitung ke kuota)`
          : undefined
        : "Stories tidak ada di export Meta — import Publishing Log untuk angka resmi",
    source: s.countSource === "log" ? "Dari Publishing Log (status Publish) · 1 baris = 1 post" : "Dari export Meta",
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
  const pick = (s: SocialSummary) => {
    const rows = s.byPlatform.filter((b) => common.includes(b.platform));
    const posts = s.posts.filter((p) => common.includes(p.platform));
    return {
      posts: posts.length,
      reach: sum(rows.map((r) => r.reach)),
      views: sum(rows.map((r) => r.views)),
      interactions: sum(rows.map((r) => r.interactions)),
      follows: posts.some((p) => p.follows != null) ? sum(posts.map((p) => p.follows)) : null,
      engagementRate: safeDiv(sum(rows.map((r) => r.interactions)), sum(rows.map((r) => r.reach))),
    };
  };
  const partial = common.length < cur.platforms.length || common.length < prev.platforms.length;
  return { platforms: common, partial, cur: pick(cur), prev: pick(prev) };
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
      [cur.social.reach, soc ? ([soc.cur.reach, soc.prev.reach] as const) : null],
    ]),
    totalEngagement: composite([
      [cur.social.interactions, soc ? ([soc.cur.interactions, soc.prev.interactions] as const) : null],
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
