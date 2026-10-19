// Parser export Meta Business Suite (Insights → Content → Export) untuk Instagram & Facebook.
import { findHeader, getCell, type HeaderMatch } from "./headers";
import { dataRows, dominantMonth, makeDataset } from "./common";
import type { Dataset, RawTable } from "./types";
import { convertTimeZone, parseCount, parseDate, parseNumber, str, strOrNull } from "./values";

export const META_FIELDS = {
  postId: ["Post ID", "ID Postingan", "ID postingan", "ID Konten"],
  pageId: ["Page ID", "ID Halaman"],
  accountId: ["Account ID", "ID Akun"],
  account: ["Account username", "Page name", "Nama pengguna akun", "Nama Halaman", "Nama akun"],
  description: ["Description", "Deskripsi", "Caption", "Keterangan"],
  title: ["Title", "Judul"],
  duration: ["Duration (sec)", "Durasi (detik)", "Durasi"],
  publishTime: ["Publish time", "Waktu publikasi", "Waktu dipublikasikan", "Waktu posting", "Tanggal publikasi"],
  permalink: ["Permalink", "Tautan permanen", "Link"],
  postType: ["Post type", "Jenis postingan", "Tipe postingan", "Jenis konten"],
  views: ["Views", "Tayangan", "Dilihat", "Impressions", "Impresi"],
  reach: ["Reach", "Jangkauan"],
  likes: ["Likes", "Suka", "Like", "Jumlah suka"],
  reactions: ["Reactions", "Reaksi"],
  comments: ["Comments", "Komentar"],
  shares: ["Shares", "Bagikan", "Dibagikan", "Dibagikan ulang"],
  saves: ["Saves", "Simpan", "Disimpan"],
  follows: ["Follows", "Ikuti", "Mengikuti", "Pengikut baru"],
  linkClicks: ["Link clicks", "Klik tautan"],
  rcs: [
    "Reactions, Comments and Shares",
    "Reactions, comments and shares",
    "Reaksi, komentar, dan bagikan",
    "Reaksi, komentar, dan dibagikan",
  ],
} as const;

type F = keyof typeof META_FIELDS;

/** Format konten ternormalisasi. */
/** Export Meta Business Suite mencatat "Publish time" dalam Pacific Time; dashboard memakai WIB. */
export const META_EXPORT_TZ = "America/Los_Angeles";
export const REPORT_TZ = "Asia/Jakarta";

export function normalizeFormat(rawType: string, platform: string, permalink: string | null): string {
  const t = rawType.toLowerCase();
  const link = (permalink ?? "").toLowerCase();
  if (/story|stories|cerita/.test(t)) return "story";
  if (/reel/.test(t) || /\/reel\//.test(link)) return "reels";
  if (/short/.test(t)) return "shorts";
  if (/carousel|album|korsel/.test(t)) return "carousel";
  if (/video/.test(t)) return platform === "instagram" ? "reels" : "video";
  if (/photo|image|foto|gambar|feed/.test(t)) return platform === "instagram" ? "feeds" : "photo";
  if (/text|status|teks/.test(t)) return "text";
  if (/link|tautan/.test(t)) return "link";
  return t || "lainnya";
}

function platformOf(m: HeaderMatch<F>, row: unknown[]): "instagram" | "facebook" {
  const link = str(getCell(row as never, m, "permalink")).toLowerCase();
  if (link.includes("instagram.com")) return "instagram";
  if (link.includes("facebook.com") || link.includes("fb.com") || link.includes("fb.watch")) return "facebook";
  const type = str(getCell(row as never, m, "postType")).toLowerCase();
  if (type.startsWith("ig ")) return "instagram";
  return m.columns.pageId !== undefined ? "facebook" : "instagram";
}

export function detectMeta(table: RawTable): Dataset[] | null {
  const m = findHeader<F>(table.rows, META_FIELDS, ["postId", "publishTime"], 5);
  if (!m || (m.columns.reach === undefined && m.columns.views === undefined)) return null;
  const n = (r: unknown[], f: F) => (f === "duration" ? parseNumber : parseCount)(getCell(r as never, m, f));

  const byPlatform: Record<string, Dataset["rows"]> = { instagram: [], facebook: [] };
  // Story IG → dataset terpisah (tabel IgStory, hanya info) supaya tidak menimpa post IG bulan itu
  const stories: Dataset["rows"] = [];
  for (const r of dataRows(table, m)) {
    const postId = str(getCell(r, m, "postId"));
    if (!postId) continue;
    const raw = parseDate(getCell(r, m, "publishTime"), "mdy");
    if (!raw) continue;
    const pub = raw.time ? convertTimeZone(raw.date, raw.time, META_EXPORT_TZ, REPORT_TZ) : { date: raw.date, time: undefined };
    const platform = platformOf(m, r);
    const permalink = strOrNull(getCell(r, m, "permalink"));
    const rawType = str(getCell(r, m, "postType"));
    const likes = n(r, "likes") ?? n(r, "reactions");
    const comments = n(r, "comments");
    const shares = n(r, "shares");
    const saves = n(r, "saves");
    const rcs = n(r, "rcs");
    const interactions = rcs ?? (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0);
    const caption = strOrNull(getCell(r, m, "description")) ?? strOrNull(getCell(r, m, "title"));
    const format = normalizeFormat(rawType, platform, permalink);
    if (platform === "instagram" && format === "story") {
      stories.push({
        storyId: postId,
        date: pub.date,
        publishedAt: `${pub.date} ${pub.time ?? "00:00"}`,
        permalink,
        durationSec: n(r, "duration"),
        views: n(r, "views"),
        reach: n(r, "reach"),
        linkClicks: n(r, "linkClicks"),
        source: "csv",
        _date: pub.date,
      });
      continue;
    }
    byPlatform[platform].push({
      platform,
      account: strOrNull(getCell(r, m, "account"))?.replace(/^@/, "").toLowerCase() ?? null,
      postId,
      date: pub.date,
      publishedAt: `${pub.date} ${pub.time ?? "00:00"}`,
      format,
      rawType: rawType || null,
      caption: caption ? caption.slice(0, 500) : null,
      permalink,
      views: n(r, "views"),
      reach: n(r, "reach"),
      likes,
      comments,
      shares,
      saves,
      follows: n(r, "follows"),
      interactions,
      durationSec: n(r, "duration"),
      _date: pub.date,
    });
  }

  const out: Dataset[] = [];
  if (stories.length) {
    out.push(
      makeDataset("meta_ig_stories", table, m, {
        month: dominantMonth(stories),
        rows: stories,
        rowDated: true,
        warnings: ["Story IG (termasuk repost) — hanya info, tidak dihitung ke KPI/kuota. Waktu publish dikonversi dari Pacific Time ke WIB."],
      }),
    );
  }
  for (const [platform, rows] of Object.entries(byPlatform)) {
    if (!rows.length) continue;
    const warnings: string[] = ["Waktu publish dikonversi dari Pacific Time (zona waktu export Meta) ke WIB."];
    if (/insight ig/i.test(table.file) && platform === "facebook") {
      warnings.push("Nama file menyebut IG, tapi isinya post Facebook (permalink facebook.com) — disimpan sebagai Facebook.");
    }
    if (m.columns.rcs === undefined && m.columns.saves === undefined) {
      warnings.push("Kolom Saves tidak ada — interaksi = likes + comments + shares.");
    }
    out.push(
      makeDataset(platform === "instagram" ? "meta_instagram" : "meta_facebook", table, m, {
        month: dominantMonth(rows),
        rows,
        rowDated: true,
        warnings,
      }),
    );
  }
  return out;
}
