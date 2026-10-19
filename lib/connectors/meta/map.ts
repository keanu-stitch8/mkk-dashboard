// Mapping Graph API (Instagram media + Facebook Page posts) → Dataset yang sama dengan import CSV Meta Business Suite.
// Murni (tanpa I/O) supaya bisa dites dengan fixture.
import type { Dataset } from "../../parsers/types";
import { normalizeFormat } from "../../parsers/meta";
import { apiDataset, num } from "../common";

/** Waktu Graph API ("2026-09-30T05:27:00+0000", offset tanpa titik dua) → epoch ms. */
export const graphTime = (iso: string): number => Date.parse(iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));

/** ISO dari Graph API ("2026-09-30T05:27:00+0000") → tanggal & jam WIB. */
export function wibDateTime(iso: string): { date: string; publishedAt: string } {
  const s = new Date(graphTime(iso) + 7 * 3600_000).toISOString();
  return { date: s.slice(0, 10), publishedAt: `${s.slice(0, 10)} ${s.slice(11, 16)}` };
}

/** Respons /{id}/insights → { metric: value }. Mendukung bentuk `values[0].value` dan `total_value.value`. */
export interface InsightsResponse {
  data?: {
    name?: string;
    period?: string;
    values?: { value?: number | Record<string, number> }[];
    total_value?: { value?: number; breakdowns?: { dimension_keys?: string[]; results?: { dimension_values?: string[]; value?: number }[] }[] };
  }[];
}

/**
 * follows_and_unfollows (breakdown follow_type, total_value) → follow baru & unfollow akun IG.
 * FOLLOWER = akun yang mulai mengikuti, NON_FOLLOWER = berhenti mengikuti / keluar dari Instagram.
 * null jika Meta tidak mengembalikan data (mis. akun < 100 followers).
 */
export function followBreakdown(res: InsightsResponse | undefined): { follows: number; unfollows: number } | null {
  const m = res?.data?.find((d) => d.name === "follows_and_unfollows");
  const results = m?.total_value?.breakdowns?.find((b) => b.dimension_keys?.includes("follow_type"))?.results;
  if (!results) return null;
  const of = (type: string) => num(results.find((r) => r.dimension_values?.[0] === type)?.value);
  return { follows: of("FOLLOWER"), unfollows: of("NON_FOLLOWER") };
}
export function insightValues(res: InsightsResponse | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  const fromLifetime = new Set<string>();
  for (const m of res?.data ?? []) {
    if (!m.name) continue;
    // Meta kadang mengembalikan metrik yang sama dua kali (lifetime + harian, mis. post_total_media_view_unique
    // saat diminta bersama metrik lain). Nilai lifetime yang dipakai; entri lain tidak boleh menimpanya.
    if (fromLifetime.has(m.name)) continue;
    if (m.period === "lifetime") fromLifetime.add(m.name);
    else if (m.name in out) continue;
    const v = m.total_value?.value ?? m.values?.[0]?.value;
    out[m.name] = typeof v === "number" ? v : v && typeof v === "object" ? Object.values(v).reduce((a, b) => a + num(b), 0) : 0;
  }
  return out;
}

export interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS | STORY | AD
  permalink?: string;
  timestamp: string;
  username?: string;
  like_count?: number;
  comments_count?: number;
}

/** Label seperti kolom "Post type" di export Meta (supaya format dinormalisasi sama persis). */
export function igPostType(m: IgMedia): string {
  if (m.media_product_type === "REELS") return "IG reel";
  if (m.media_product_type === "STORY") return "IG story";
  if (m.media_type === "CAROUSEL_ALBUM") return "IG carousel";
  if (m.media_type === "VIDEO") return "IG reel";
  return "IG image";
}

/** Metrik insight yang valid per jenis media (meminta metrik yang tidak didukung membuat request error). */
export function igMetricsFor(m: IgMedia): string[] {
  const base = ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions"];
  return m.media_product_type === "REELS" ? base : [...base, "follows"];
}

export function mapInstagram(media: IgMedia[], insights: Map<string, Record<string, number>>, month: string, source: string, accountMetrics: Record<string, number> = {}): Dataset {
  const rows = media
    .filter((m) => m.media_product_type !== "STORY" && m.media_product_type !== "AD")
    .map((m) => {
      const ins = insights.get(m.id) ?? {};
      const { date, publishedAt } = wibDateTime(m.timestamp);
      const rawType = igPostType(m);
      const likes = ins.likes ?? num(m.like_count);
      const comments = ins.comments ?? num(m.comments_count);
      const shares = ins.shares ?? null;
      const saves = ins.saved ?? null;
      return {
        platform: "instagram",
        account: m.username?.toLowerCase() ?? null,
        postId: m.id,
        date,
        publishedAt,
        format: normalizeFormat(rawType, "instagram", m.permalink ?? null),
        rawType,
        caption: m.caption ? m.caption.slice(0, 500) : null,
        permalink: m.permalink ?? null,
        views: ins.views ?? null,
        reach: ins.reach ?? null,
        likes,
        comments,
        shares,
        saves,
        follows: ins.follows ?? null,
        // sama dengan import CSV: likes + comments + shares + saves
        interactions: likes + comments + num(shares) + num(saves),
        durationSec: null,
        _date: date,
      };
    });
  const metrics = Object.entries(accountMetrics).map(([key, value]) => ({ channel: "social" as const, key: `ig_account_${key}`, value }));
  return apiDataset("meta_instagram", source, month, { rows, rowDated: true, metrics });
}

export interface FbPost {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  attachments?: { data?: { media_type?: string; type?: string }[] };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

/** Label seperti kolom "Post type" export Meta Facebook. */
export function fbPostType(p: FbPost): string {
  const a = p.attachments?.data?.[0];
  const t = `${a?.media_type ?? ""} ${a?.type ?? ""}`.toLowerCase();
  if (t.includes("video") || /\/(reel|videos)\//.test(p.permalink_url ?? "")) return "Videos";
  if (t.includes("album")) return "Photos";
  if (t.includes("photo")) return "Photos";
  if (t.includes("link") || t.includes("share")) return "Links";
  return "Status";
}

export function mapFacebook(posts: FbPost[], insights: Map<string, Record<string, number>>, month: string, source: string, account: string | null): Dataset {
  const rows = posts.map((p) => {
    const ins = insights.get(p.id) ?? {};
    const { date, publishedAt } = wibDateTime(p.created_time);
    const rawType = fbPostType(p);
    const reactions = num(p.reactions?.summary?.total_count);
    const comments = num(p.comments?.summary?.total_count);
    const shares = num(p.shares?.count);
    return {
      platform: "facebook",
      account,
      postId: p.id,
      date,
      publishedAt,
      format: normalizeFormat(rawType, "facebook", p.permalink_url ?? null),
      rawType,
      caption: p.message ? p.message.slice(0, 500) : null,
      permalink: p.permalink_url ?? null,
      views: ins.post_media_view ?? null,
      reach: ins.post_total_media_view_unique ?? null,
      likes: reactions,
      comments,
      shares,
      saves: null,
      follows: null,
      // sama dengan kolom "Reactions, Comments and Shares" di export Meta
      interactions: reactions + comments + shares,
      durationSec: null,
      _date: date,
    };
  });
  return apiDataset("meta_facebook", source, month, { rows, rowDated: true });
}

/** Baris snapshot metrik lifetime per post IG (model IgMediaSnapshot) — memakai mapping yang sama dengan mapInstagram. */
export function snapshotRows(media: IgMedia[], insights: Map<string, Record<string, number>>, date: string) {
  return mapInstagram(media, insights, date.slice(0, 7), "snapshot").rows.map((r) => ({
    date,
    mediaId: String(r.postId),
    publishedDate: String(r.date),
    format: String(r.format),
    views: r.views as number | null,
    reach: r.reach as number | null,
    likes: r.likes as number | null,
    comments: r.comments as number | null,
    shares: r.shares as number | null,
    saves: r.saves as number | null,
    interactions: r.interactions as number | null,
  }));
}
