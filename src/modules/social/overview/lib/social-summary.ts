import { daysInMonth } from "@/lib/month";
import { OWN_SOCIAL_ACCOUNTS } from "@/lib/sources";
import { socialFormatKey } from "@/lib/taxonomy";
import { longestEmptyStreak } from "@/modules/shared/lib/empty-streak";
import { safeDiv, sum } from "@/modules/shared/lib/math";
import { matchLogsToPosts, NOT_IN_LOG_LABEL, reconcileSocial } from "../../shared/lib/social-match";
import type { SocialByType, SocialStoriesInfo, SocialSummary, SocialSummaryInput } from "../types/social-summary";

/** Urutan & label jenis konten dari breakdown media_product_type insight akun IG. */
export const IG_TYPES: { type: string; label: string }[] = [
  { type: "REEL", label: "Reels" },
  { type: "CAROUSEL_CONTAINER", label: "Carousel" },
  { type: "POST", label: "Photo / other" },
  { type: "STORY", label: "Story" },
];

/**
 * Views & reach selama bulan itu per jenis konten + interactions (Meta menggabungkan carousel & foto ke "POST"
 * untuk interactions). Termasuk post lama yang masih ditonton bulan itu. Null jika belum ada datanya.
 */
function igByType(rows: SocialSummaryInput["igTypeRows"]): SocialByType | null {
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
function storiesInfo(month: string, rows: SocialSummaryInput["storyRows"], firstApi: string | null, logCount: number): SocialStoriesInfo | null {
  if (!rows.length) return null;
  const csvLast = rows.filter((r) => r.source === "csv").reduce<string | null>((a, r) => (a && a > r.date ? a : r.date), null);
  const apiStart = firstApi && firstApi > `${month}-01` && firstApi.startsWith(month) ? firstApi : null;
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

/** Ringkasan Social satu bulan: post Meta milik akun MKK + Publishing Log + insight akun IG + Task Progress. */
export function buildSocialSummary({
  month,
  allPosts,
  logs,
  quota,
  manual,
  imports,
  account: accountMetrics,
  hasReviewImport,
  reviewItems,
  monthSnapshot,
  igTypeRows,
  storyRows,
  firstApiStoryDate,
}: SocialSummaryInput): SocialSummary {
  const account = (k: string) => accountMetrics[k] ?? null;

  // Hanya post milik akun MKK yang dihitung; kolaborasi/repost dari akun lain dipisah.
  const own = ownAccounts(allPosts);
  const posts = allPosts.filter((p) => !p.account || own.has(`${p.platform}:${p.account}`));
  const collabPosts = allPosts.filter((p) => !posts.includes(p)).map((p) => ({ ...p, er: safeDiv(p.interactions, p.reach) }));

  const matched = matchLogsToPosts(posts, logs);
  const postByLog = new Map([...matched].flatMap(([id, l]) => {
    const post = posts.find((p) => p.id === id);
    return post ? [[l.id, post] as const] : [];
  }));
  const monthSnap = monthSnapshot;
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
  // Stories/Reels/Feeds/Video selalu tampil (0 jika belum ada) supaya rincian per format konsisten antar bulan
  const publishedByFormat = Object.entries(
    units.reduce<Record<string, number>>((a, u) => ((a[u.format] = (a[u.format] ?? 0) + 1), a), { story: 0, reels: 0, feeds: 0, video: 0 }),
  )
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count);

  const hasReview = manual.inReview != null || hasReviewImport;
  const inReview = manual.inReview ?? reviewItems.length;
  // Kuota sosmed: satu angka untuk semua format (Publishing Log = sumber resmi). Delivered = published + in review
  // (snapshot akhir bulan dari Task Progress), sama dengan definisi News & YouTube.
  const quotaProgress = [{ quota, count: postsPublished + inReview }].map((q) => ({
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
  // carousel & foto dari Meta = Feed (taksonomi bersama)
  const byFormat = aggregate((p) => ({ label: `${p.platform}:${socialFormatKey(p.format)}`, platform: p.platform, format: socialFormatKey(p.format) }));
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
    inReviewItems: reviewItems,
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
    stories: storiesInfo(month, storyRows, firstApiStoryDate, publishedLogs.filter((l) => l.format === "story").length),
    /** tanggal acuan metrik lifetime per post (waktu sync/import post IG bulan itu) */
    postsAsOf: imports.find((i) => i.source === "meta_instagram")?.createdAt ?? null,
    /** tanggal snapshot yang dipakai untuk "views bulan ini" per post (null = belum ada snapshot setelah bulan selesai) */
    monthViewsAsOf: monthSnap?.date ?? null,
    /** insight akun selama bulan itu per jenis konten (per periode, stabil saat sync ulang) */
    byType: igByType(igTypeRows),
    /** post kolaborasi/repost milik akun lain — tidak dihitung ke performa maupun kuota */
    collabPosts,
    activeDays: activeDates.size,
    emptyStreak: longestEmptyStreak(month, activeDates),
    byPlatform,
    byFormat,
    byCategory: logs.length ? byCategory : [],
    topPosts: [...enriched].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0)).slice(0, 10),
    daily,
    // link konten: URL di log, atau permalink post Meta pasangannya (log Sosmed umumnya tanpa URL);
    // igMediaId = ID media IG pasangannya (dasar thumbnail)
    logs: logs.map((l) => {
      const post = postByLog.get(l.id);
      return { ...l, link: l.url ?? post?.permalink ?? null, igMediaId: post?.platform === "instagram" ? post.postId : null };
    }),
  };
}
