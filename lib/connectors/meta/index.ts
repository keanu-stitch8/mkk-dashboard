// Connector Meta — Graph API (Instagram API with Facebook Login + Facebook Page) memakai token system user.
//  • Instagram: /{ig-user-id}/media → /{media-id}/insights per media; insight akun /{ig-user-id}/insights (total_value)
//  • Facebook: page access token dari /{page-id}?fields=access_token → /{page-id}/posts → /{post-id}/insights
// Hasilnya Dataset meta_instagram / meta_facebook yang sama dengan import CSV Meta Business Suite.
// Hanya platform di ACTIVE_SOCIAL_PLATFORMS (lib/sources.ts) yang ditarik.
import type { Dataset } from "../../parsers/types";
import { prisma } from "../../db";
import { ACTIVE_SOCIAL_PLATFORMS } from "../../sources";
import type { Connector, ConnectorStatus, TestResult } from "../types";
import { ConnectorError } from "../types";
import { monthRange } from "../common";
import { upsertIgStories } from "../../import/stories";
import { GraphError, META_PERMISSIONS, metaErrorMessage } from "./errors";
import { GRAPH_VERSION, graphGet, graphInsights, graphPaginate, mapLimit, type Paged } from "./graph";
import { followBreakdown, typeBreakdown, graphTime, igMetricsFor, mapFacebook, mapInstagram, snapshotRows, wibDateTime, type FbPost, type IgMedia, type InsightsResponse } from "./map";
import { WIB, addDays, dateIn, zonedInstant } from "../../tz";

const IG_MEDIA_FIELDS = "id,caption,media_type,media_product_type,permalink,timestamp,username,like_count,comments_count";
const FB_POST_FIELDS =
  "id,message,created_time,permalink_url,attachments{media_type,type},reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares";
const FB_POST_METRICS = ["post_media_view", "post_total_media_view_unique"];
/**
 * Insight akun IG selama bulan itu (total_value). Views & interactions bisa dijumlah per potongan (pas persis);
 * reach & accounts engaged = akun unik, tidak bisa dijumlah → satu request (maks. 30 hari).
 * follower_count tidak lagi terdokumentasi untuk period=day → dilewati.
 */
const IG_ACCOUNT_ADDITIVE = ["views", "total_interactions"];
const IG_ACCOUNT_UNIQUE = ["reach", "accounts_engaged"];
/** Izin minimum per platform; sisanya di META_PERMISSIONS direkomendasikan. */
const REQUIRED_PERMS = {
  facebook: ["pages_show_list", "pages_read_engagement", "read_insights"],
  instagram: ["instagram_basic", "instagram_manage_insights"],
};
/** Paralelisme request insights per media/post. */
const CONCURRENCY = 4;
/** Insight akun IG dibatasi Meta maksimal 30 hari per request (since–until). */
const MAX_RANGE_SEC = 30 * 86400;

const facebookActive = () => ACTIVE_SOCIAL_PLATFORMS.includes("facebook");
/** Snapshot metrik lifetime: post IG yang dipublish dalam N hari terakhir. */
const SNAPSHOT_DAYS = 90;

const env = (k: string) => process.env[k]?.trim() || undefined;
const token = () => env("META_ACCESS_TOKEN");

interface PageInfo {
  id: string;
  name?: string;
  username?: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string };
}

interface Ids {
  page?: PageInfo;
  pageToken?: string;
  igUserId?: string;
}

function translate(e: unknown, ids?: Ids): ConnectorError {
  if (e instanceof ConnectorError) return e;
  const raw = e instanceof GraphError ? e.toRaw() : String((e as Error)?.message ?? e);
  return new ConnectorError(metaErrorMessage(e, { pageId: ids?.page?.id ?? env("META_PAGE_ID"), igUserId: ids?.igUserId ?? env("META_IG_USER_ID") }), raw);
}

/** Page (+ page access token) dan ID akun IG. IG dicari dari Page jika META_IG_USER_ID kosong. */
async function resolveIds(tok: string): Promise<Ids> {
  const pageId = env("META_PAGE_ID");
  let page: PageInfo | undefined;
  if (pageId) {
    page = await graphGet<PageInfo>(`/${pageId}`, tok, { fields: "id,name,username,access_token,instagram_business_account{id,username}" });
    if (!page.access_token && facebookActive()) {
      throw new ConnectorError(
        `Token tidak mendapat page access token untuk Page ${page.name ?? pageId}. Assign Page ke system user dengan akses penuh (Business Settings → System users → Assign assets → Pages → "Manage Page"), lalu generate ulang token dengan izin pages_show_list.`,
      );
    }
  }
  const igUserId = env("META_IG_USER_ID") ?? page?.instagram_business_account?.id;
  return { page, pageToken: page?.access_token, igUserId };
}

/** Batas bulan dalam detik UNIX: 00:00 WIB tanggal 1 s/d 00:00 WIB setelah hari terakhir (dipotong ke hari ini jika bulan berjalan). */
export function monthWindow(month: string) {
  const { start, end, partial } = monthRange(month);
  const since = zonedInstant(start, "00:00", WIB) / 1000;
  const until = zonedInstant(addDays(end, 1), "00:00", WIB) / 1000;
  return { start, end, partial, since, until };
}

const inMonth = (iso: string, month: string) => wibDateTime(iso).date.startsWith(month);

/** Insight per media (lifetime). Media tanpa insight (dipublish sebelum jadi akun bisnis) dilewati. */
async function mediaInsights(tok: string, media: IgMedia[]): Promise<{ insights: Map<string, Record<string, number>>; rejected: Map<string, number>; unavailable: number }> {
  const insights = new Map<string, Record<string, number>>();
  const rejected = new Map<string, number>();
  let unavailable = 0;
  await mapLimit(media, CONCURRENCY, async (m) => {
    try {
      const res = await graphInsights(m.id, tok, igMetricsFor(m));
      insights.set(m.id, res.values);
      for (const r of res.rejected) rejected.set(r, (rejected.get(r) ?? 0) + 1);
    } catch (e) {
      // 10/2108006: media dipublish sebelum akun dikonversi ke akun bisnis — insight tidak tersedia
      if (e instanceof GraphError && e.code === 10 && e.subcode === 2108006) unavailable++;
      else throw e;
    }
  });
  return { insights, rejected, unavailable };
}

/**
 * Simpan snapshot metrik lifetime semua post IG dalam SNAPSHOT_DAYS hari terakhir (maks. 1x per hari, WIB).
 * Insight yang sudah diambil sync bulan ini dipakai ulang. Gagal tidak menggagalkan sync — hanya peringatan.
 */
async function snapshotRecentMedia(tok: string, igUserId: string, known: Map<string, Record<string, number>>, warnings: string[]): Promise<void> {
  const now = Date.now();
  const today = dateIn(now, WIB);
  try {
    if (await prisma.igMediaSnapshot.findFirst({ where: { date: today }, select: { id: true } })) return;
    const cutoff = now - SNAPSHOT_DAYS * 86400_000;
    const all = await graphPaginate<IgMedia>(`/${igUserId}/media`, tok, { fields: IG_MEDIA_FIELDS, limit: 50 }, (m) => graphTime(m.timestamp) < cutoff);
    const recent = all.filter((m) => graphTime(m.timestamp) >= cutoff);
    const missing = recent.filter((m) => !known.has(m.id));
    const fetched = await mediaInsights(tok, missing);
    const insights = new Map([...known, ...fetched.insights]);
    const rows = snapshotRows(recent, insights, today);
    if (rows.length) await prisma.igMediaSnapshot.createMany({ data: rows });
  } catch (e) {
    if (e instanceof GraphError && e.code === 190) throw e;
    warnings.push(`Instagram: snapshot metrik per post gagal disimpan (${e instanceof GraphError ? metaErrorMessage(e) : (e as Error).message}). Data bulan ini tetap tersimpan.`);
  }
}

/**
 * Insight akun selama bulan itu per jenis konten (breakdown media_product_type) → tabel IgAccountByType.
 * Views & interactions dijumlah per potongan ≤30 hari; reach unik → 30 hari pertama saja (sama dengan KPI reach).
 * Termasuk post lama yang masih ditonton bulan itu. Bulan terkunci hanya diisi jika belum ada datanya.
 */
async function saveIgTypes(tok: string, igUserId: string, month: string): Promise<number> {
  const { isMonthLocked } = await import("../lock");
  if ((await isMonthLocked(month)) && (await prisma.igAccountByType.count({ where: { month } }))) return 0;
  const w = monthWindow(month);
  const params = { period: "day", metric_type: "total_value", breakdown: "media_product_type" };
  const acc = new Map<string, { metric: string; type: string; value: number }>();
  const add = (rows: { metric: string; type: string; value: number }[]) => {
    for (const r of rows) {
      const k = `${r.metric}|${r.type}`;
      acc.set(k, { ...r, value: (acc.get(k)?.value ?? 0) + r.value });
    }
  };
  for (const [since, until] of rangeChunks(w)) add(typeBreakdown(await graphGet<InsightsResponse>(`/${igUserId}/insights`, tok, { ...params, metric: IG_ACCOUNT_ADDITIVE.join(","), since, until })));
  add(typeBreakdown(await graphGet<InsightsResponse>(`/${igUserId}/insights`, tok, { ...params, metric: "reach", since: w.since, until: Math.min(w.until, w.since + MAX_RANGE_SEC) })));
  const rows = [...acc.values()].filter((r) => r.metric);
  for (const r of rows) await prisma.igAccountByType.upsert({ where: { month_metric_type: { month, metric: r.metric, type: r.type } }, create: { month, ...r }, update: { value: r.value } });
  return rows.length;
}

/**
 * Untuk cron: snapshot harian metrik lifetime post IG (maks. 1x per hari WIB). Snapshot pertama setelah
 * tanggal 1 menjadi batas "views bulan ini" per post. Null jika sudah ada snapshot hari ini / Meta belum siap.
 */
export async function snapshotIgDaily(): Promise<string[] | null> {
  const tok = token();
  const today = dateIn(Date.now(), WIB);
  if (!tok || (await prisma.igMediaSnapshot.findFirst({ where: { date: today }, select: { id: true } }))) return null;
  try {
    const ids = await resolveIds(tok);
    if (!ids.igUserId) return null;
    const warnings: string[] = [];
    await snapshotRecentMedia(tok, ids.igUserId, new Map(), warnings);
    return warnings;
  } catch (e) {
    throw translate(e);
  }
}

/** Untuk backfill: isi insight per jenis konten satu bulan (tanpa menyentuh data lain). */
export async function syncIgTypes(month: string): Promise<number | null> {
  const tok = token();
  if (!tok) return null;
  try {
    const ids = await resolveIds(tok);
    return ids.igUserId ? await saveIgTypes(tok, ids.igUserId, month) : null;
  } catch (e) {
    throw translate(e);
  }
}

/** Metrik insight Story (link clicks tidak tersedia di API — hanya di export CSV). */
const STORY_METRICS = ["reach", "views"];

/**
 * Simpan Story IG yang sedang aktif (API hanya memberi Story ≤24 jam terakhir) ke tabel IgStory — hanya info,
 * bukan KPI. Dipanggil tiap sync Meta & cron Story; Story yang sudah tersimpan diperbarui metriknya.
 */
async function collectStories(tok: string, igUserId: string): Promise<number> {
  const stories = await graphPaginate<IgMedia>(`/${igUserId}/stories`, tok, { fields: "id,media_type,media_product_type,permalink,timestamp", limit: 50 });
  const insights = new Map<string, Record<string, number>>();
  await mapLimit(stories, CONCURRENCY, async (m) => {
    try {
      insights.set(m.id, (await graphInsights(m.id, tok, STORY_METRICS)).values);
    } catch (e) {
      if (e instanceof GraphError && e.code === 190) throw e;
    }
  });
  return upsertIgStories(
    prisma,
    stories.map((m) => {
      const { date, publishedAt } = wibDateTime(m.timestamp);
      const ins = insights.get(m.id) ?? {};
      return { storyId: m.id, date, publishedAt, permalink: m.permalink ?? null, durationSec: null, views: ins.views ?? null, reach: ins.reach ?? null, linkClicks: null, source: "api" as const };
    }),
  );
}

/** Untuk cron: kumpulkan Story aktif. Null jika Meta belum dikonfigurasi / akun IG tidak ditemukan. */
export async function syncIgStories(): Promise<number | null> {
  const tok = token();
  if (!tok) return null;
  try {
    const ids = await resolveIds(tok);
    return ids.igUserId ? await collectStories(tok, ids.igUserId) : null;
  } catch (e) {
    throw translate(e);
  }
}

async function fetchInstagram(tok: string, igUserId: string, month: string, w: ReturnType<typeof monthWindow>, warnings: string[]): Promise<Dataset> {
  try {
    await collectStories(tok, igUserId);
  } catch (e) {
    if (e instanceof GraphError && e.code === 190) throw e;
    warnings.push(`Instagram: Story aktif tidak bisa disimpan (${metaErrorMessage(e)}). Data post tetap tersimpan.`);
  }
  // /media urut terbaru dulu; berhenti saat sudah melewati awal bulan.
  const all = await graphPaginate<IgMedia>(`/${igUserId}/media`, tok, { fields: IG_MEDIA_FIELDS, limit: 50 }, (m) => graphTime(m.timestamp) / 1000 < w.since - 86400);
  const media = all.filter((m) => inMonth(m.timestamp, month));
  const username = media[0]?.username ?? all[0]?.username;
  const source = `API Meta Graph ${GRAPH_VERSION} · Instagram${username ? ` @${username}` : ""} · ${w.start} s/d ${w.end}`;
  if (!media.length) {
    // Dataset kosong tidak disimpan; jangan tambahkan metrik akun supaya data lama (import CSV) tidak tertimpa.
    warnings.push(`Instagram: tidak ada post di ${month} — data lama tidak diubah.`);
    await snapshotRecentMedia(tok, igUserId, new Map(), warnings);
    return mapInstagram([], new Map(), month, source);
  }

  const { insights, rejected, unavailable } = await mediaInsights(tok, media);
  await snapshotRecentMedia(tok, igUserId, insights, warnings);
  for (const [m, n] of rejected) warnings.push(`Instagram: metrik "${m}" ditolak Meta untuk ${n} post — dilewati.`);
  if (unavailable) warnings.push(`Instagram: insight ${unavailable} post tidak tersedia (dipublish sebelum akun menjadi akun bisnis).`);

  const account = await igAccountInsights(tok, igUserId, w, warnings);
  try {
    await saveIgTypes(tok, igUserId, month);
  } catch (e) {
    if (e instanceof GraphError && e.code === 190) throw e;
    warnings.push(`Instagram: insight per jenis konten tidak bisa diambil (${metaErrorMessage(e)}). Data lain tetap tersimpan.`);
  }
  return mapInstagram(media, insights, month, source, account);
}

/** Potongan [since, until) ≤ 30 hari yang menutup rentang bulan (batas Meta untuk insight akun). */
export function rangeChunks(w: { since: number; until: number }): [number, number][] {
  const out: [number, number][] = [];
  for (let since = w.since; since < w.until; since += MAX_RANGE_SEC) out.push([since, Math.min(since + MAX_RANGE_SEC, w.until)]);
  return out;
}

/** Insight tingkat akun selama bulan itu. Gagal tidak menggagalkan sync — hanya peringatan. */
async function igAccountInsights(tok: string, igUserId: string, w: ReturnType<typeof monthWindow>, warnings: string[]): Promise<Record<string, number>> {
  const params = { period: "day", metric_type: "total_value" };
  try {
    const out: Record<string, number> = {};
    const rejected = new Set<string>();
    for (const [since, until] of rangeChunks(w)) {
      const res = await graphInsights(igUserId, tok, IG_ACCOUNT_ADDITIVE, { ...params, since, until });
      for (const [k, v] of Object.entries(res.values)) out[k] = (out[k] ?? 0) + v;
      res.rejected.forEach((r) => rejected.add(r));
    }
    const until = Math.min(w.until, w.since + MAX_RANGE_SEC);
    const unique = await graphInsights(igUserId, tok, IG_ACCOUNT_UNIQUE, { ...params, since: w.since, until });
    Object.assign(out, unique.values);
    unique.rejected.forEach((r) => rejected.add(r));
    if (until < w.until) {
      warnings.push(`Instagram: reach & accounts engaged akun hanya mencakup 30 hari pertama — Meta membatasi maks. 30 hari per request dan reach unik tidak bisa dijumlah. Views & interactions tetap sebulan penuh.`);
    }
    if (rejected.size) warnings.push(`Instagram: metrik akun ${[...rejected].join(", ")} ditolak Meta — dilewati.`);
    const follows = await igFollows(tok, igUserId, w);
    if (follows) return { ...out, follows: follows.follows, unfollows: follows.unfollows };
    warnings.push("Instagram: follows akun tidak tersedia dari Meta (follows_and_unfollows hanya ada untuk akun ≥ 100 followers).");
    return out;
  } catch (e) {
    if (e instanceof GraphError && e.code === 190) throw e;
    warnings.push(`Instagram: insight akun tidak bisa diambil (${metaErrorMessage(e)}). Data per post tetap tersimpan.`);
    return {};
  }
}

/**
 * Follow baru & unfollow akun selama rentang bulan (follows_and_unfollows, breakdown follow_type).
 * Angkanya bisa dijumlah per potongan, jadi bulan 31 hari diminta dalam potongan ≤ 30 hari.
 */
export async function igFollows(tok: string, igUserId: string, w: ReturnType<typeof monthWindow>): Promise<{ follows: number; unfollows: number } | null> {
  const parts: { follows: number; unfollows: number }[] = [];
  for (const [since, until] of rangeChunks(w)) {
    const res = await graphGet<InsightsResponse>(`/${igUserId}/insights`, tok, { metric: "follows_and_unfollows", period: "day", metric_type: "total_value", breakdown: "follow_type", since, until });
    const part = followBreakdown(res);
    if (part) parts.push(part);
  }
  if (!parts.length) return null;
  return { follows: parts.reduce((a, p) => a + p.follows, 0), unfollows: parts.reduce((a, p) => a + p.unfollows, 0) };
}

async function fetchFacebook(ids: Ids, month: string, w: ReturnType<typeof monthWindow>, warnings: string[]): Promise<Dataset> {
  const page = ids.page!;
  const tok = ids.pageToken!;
  const all = await graphPaginate<FbPost>(`/${page.id}/posts`, tok, { fields: FB_POST_FIELDS, since: w.since, until: w.until, limit: 100 });
  const posts = all.filter((p) => inMonth(p.created_time, month));

  const insights = new Map<string, Record<string, number>>();
  const rejected = new Map<string, number>();
  await mapLimit(posts, CONCURRENCY, async (p) => {
    const res = await graphInsights(p.id, tok, FB_POST_METRICS);
    insights.set(p.id, res.values);
    for (const r of res.rejected) rejected.set(r, (rejected.get(r) ?? 0) + 1);
  });
  // Sejumlah metrik Page dicabut Meta 15 Jun 2026 — jangan gagalkan sync, cukup beri tahu.
  for (const [m, n] of rejected) warnings.push(`Facebook: metrik "${m}" ditolak Meta untuk ${n} post (kemungkinan sudah dicabut) — dilewati.`);
  const account = (page.username ?? page.name)?.toLowerCase() ?? null;
  return mapFacebook(posts, insights, month, `API Meta Graph ${GRAPH_VERSION} · Facebook ${page.name ?? page.id} · ${w.start} s/d ${w.end}`, account);
}

async function grantedPermissions(tok: string): Promise<Set<string> | null> {
  try {
    const res = await graphGet<Paged<{ permission: string; status: string }>>("/me/permissions", tok);
    return new Set((res.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission));
  } catch {
    return null;
  }
}

export const meta: Connector = {
  id: "meta",
  env: [
    { name: "META_ACCESS_TOKEN", required: true, hint: "Token system user (Business Settings → System users → Generate new token)." },
    { name: "META_PAGE_ID", required: false, hint: "ID Page Facebook Main ke Kudus — untuk post Facebook & mencari akun IG otomatis." },
    { name: "META_IG_USER_ID", required: false, hint: "Opsional — ID akun Instagram bisnis (otomatis dari Page jika kosong)." },
    { name: "META_APP_SECRET", required: false, hint: "Opsional — wajib jika app Meta mengaktifkan “Require App Secret”." },
  ],

  async status(): Promise<ConnectorStatus> {
    const missing: string[] = [];
    if (!token()) missing.push("META_ACCESS_TOKEN");
    if (!env("META_PAGE_ID") && !env("META_IG_USER_ID")) missing.push("META_PAGE_ID");
    const parts = [env("META_PAGE_ID") && `Page ${env("META_PAGE_ID")}`, env("META_IG_USER_ID") ? `IG ${env("META_IG_USER_ID")}` : env("META_PAGE_ID") && "akun IG dicari otomatis dari Page"].filter(Boolean);
    return { configured: !missing.length, missing, account: parts.length ? `${parts.join(" · ")} · Graph API ${GRAPH_VERSION}` : undefined };
  },

  async testConnection(): Promise<TestResult> {
    const tok = token();
    if (!tok) return { ok: false, message: "META_ACCESS_TOKEN belum diisi di .env.local (atau .env)." };
    let ids: Ids | undefined;
    try {
      const me = await graphGet<{ id: string; name?: string }>("/me", tok, { fields: "id,name" });
      ids = await resolveIds(tok);
      const lines = [`Token milik ${me.name ?? me.id} (Graph API ${GRAPH_VERSION}).`];

      const granted = await grantedPermissions(tok);
      const need = [...(ids.page && facebookActive() ? REQUIRED_PERMS.facebook : []), ...(ids.igUserId ? REQUIRED_PERMS.instagram : [])];
      const missingPerms = granted ? need.filter((p) => !granted.has(p)) : [];
      if (missingPerms.length) return { ok: false, message: `${lines[0]} Izin token kurang: ${missingPerms.join(", ")}. Generate ulang token system user dengan izin ${META_PERMISSIONS.join(", ")}.` };
      const optional = granted ? META_PERMISSIONS.filter((p) => !need.includes(p) && !granted.has(p)) : [];

      if (ids.page && !facebookActive()) {
        lines.push(`Page Facebook: ${ids.page.name ?? ids.page.id} (post Facebook tidak ditarik — hanya ${ACTIVE_SOCIAL_PLATFORMS.join(", ")} yang dihitung).`);
      } else if (ids.page) {
        // cek insight post dengan page access token
        const posts = await graphGet<Paged<FbPost>>(`/${ids.page.id}/posts`, ids.pageToken!, { fields: "id,created_time", limit: 1 });
        const last = posts.data?.[0];
        if (last) await graphInsights(last.id, ids.pageToken!, FB_POST_METRICS);
        lines.push(`Page Facebook: ${ids.page.name ?? ids.page.id}${last ? ` (post terakhir ${wibDateTime(last.created_time).date})` : " (belum ada post)"}.`);
      }
      if (ids.igUserId) {
        const ig = await graphGet<{ id: string; username?: string; followers_count?: number; media_count?: number }>(`/${ids.igUserId}`, tok, { fields: "id,username,followers_count,media_count" });
        const media = await graphGet<Paged<IgMedia>>(`/${ids.igUserId}/media`, tok, { fields: IG_MEDIA_FIELDS, limit: 1 });
        if (media.data?.[0]) await graphInsights(media.data[0].id, tok, igMetricsFor(media.data[0]));
        lines.push(
          `Instagram: @${ig.username ?? ig.id} · ${Number(ig.followers_count ?? 0).toLocaleString("id-ID")} followers · ${Number(ig.media_count ?? 0).toLocaleString("id-ID")} post${env("META_IG_USER_ID") ? "" : ` (ID ${ig.id} dari Page)`}.`,
        );
      } else {
        lines.push("Instagram: Page ini belum terhubung ke akun Instagram bisnis — isi META_IG_USER_ID atau hubungkan IG ke Page.");
      }
      if (optional.length) lines.push(`Catatan: izin ${optional.join(", ")} belum diberikan; jika sync gagal karena izin, tambahkan.`);
      return { ok: true, message: lines.join(" ") };
    } catch (e) {
      return { ok: false, message: translate(e, ids).message };
    }
  },

  async fetchMonth(month: string) {
    const tok = token();
    if (!tok) throw new ConnectorError("META_ACCESS_TOKEN belum diisi di .env.local (atau .env).");
    let ids: Ids | undefined;
    try {
      const w = monthWindow(month);
      ids = await resolveIds(tok);
      const datasets: Dataset[] = [];
      const warnings: string[] = [];
      if (ids.igUserId) datasets.push(await fetchInstagram(tok, ids.igUserId, month, w, warnings));
      else warnings.push("Instagram dilewati: akun IG tidak ditemukan (isi META_IG_USER_ID atau hubungkan IG ke Page).");
      if (ids.page && facebookActive()) datasets.push(await fetchFacebook(ids, month, w, warnings));
      if (w.partial) warnings.push(`Bulan berjalan — data sampai ${w.end}. Metrik Meta bersifat lifetime & bisa terlambat ±48 jam; sync ulang setelah awal bulan depan.`);
      for (const d of datasets) d.warnings.push(...warnings.filter((x) => !x.startsWith(d.key === "meta_instagram" ? "Facebook:" : "Instagram:")));
      return datasets;
    } catch (e) {
      throw translate(e, ids);
    }
  },
};
