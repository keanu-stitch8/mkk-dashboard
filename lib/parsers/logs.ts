// Parser log dari Google Sheets: News Content Logs, Publishing log sosmed,
// plus sheet "Article Performance" di report News (views per artikel).
import { findHeader, getCell } from "./headers";
import { dataRows, dominantMonth, findUrlInRow, makeDataset, normalizeStatus } from "./common";
import type { Dataset, RawTable } from "./types";
import { normalizePath, parseCount, parseDate, parseDuration, str, strOrNull } from "./values";

export const NEWS_FIELDS = {
  date: ["Publish Date", "Tanggal Publish", "Tanggal Terbit", "Tanggal Tayang", "Tanggal", "Date", "Planned Date", "Tanggal Rencana"],
  submittedDate: ["Submitted Date", "Tanggal Submit", "Tanggal Kirim", "Tanggal Masuk"],
  title: ["Headline", "Judul", "Judul Artikel", "Title", "Article"],
  url: ["Article URL", "URL", "URL Artikel", "Link", "Link Artikel", "Tautan"],
  category: ["Category", "Kategori", "Rubrik"],
  reporter: ["Reporter", "Kontributor", "Contributor", "Penulis", "Writer", "Author", "Wartawan", "Jurnalis"],
  status: ["Status"],
  type: ["Type", "Tipe", "Jenis", "Content Type", "Tipe Konten", "Jenis Berita"],
  method: ["Method", "Metode", "Metode Liputan"],
  views: ["Views", "Tampilan", "Dilihat", "Pageviews", "Page views"],
  activeUsers: ["Active Users", "Pengguna Aktif", "Users"],
  avgEngagement: ["Avg Engagement", "Average engagement time", "Rata-rata engagement", "Avg Engagement Time"],
} as const;

export const SOCIAL_LOG_FIELDS = {
  date: ["Tanggal", "Date", "Publish Date", "Tanggal Posting", "Tanggal Upload", "Tanggal Publish", "Tanggal Tayang"],
  platform: ["Channels", "Channel", "Platforms", "Platform", "Kanal", "Media", "Sosmed", "Akun"],
  format: ["Tipe", "Type", "Format", "Jenis", "Tipe Konten", "Jenis Konten"],
  category: ["Kategori", "Category", "Categories", "Pilar", "Content Pillar", "Pilar Konten"],
  admin: ["Admin", "PIC", "PIC Admin"],
  designer: ["Designer", "Desainer", "Designer / Editor", "Editor", "Designer/Editor"],
  status: ["Status"],
  title: ["Judul", "Title", "Caption", "Konten", "Content", "Topik", "Headline", "Judul Konten"],
  url: ["Link", "URL", "Permalink", "Tautan", "Link Post"],
} as const;

type N = keyof typeof NEWS_FIELDS;
type S = keyof typeof SOCIAL_LOG_FIELDS;

export function normalizePlatform(v: string): string {
  const s = v.trim().toLowerCase();
  if (/^(ig|insta|instagram)/.test(s)) return "instagram";
  if (/^(fb|facebook)/.test(s)) return "facebook";
  if (/tiktok|tik tok|tt$/.test(s)) return "tiktok";
  if (/^(yt|youtube)/.test(s)) return "youtube";
  return s || "lainnya";
}

/** Views per artikel (sheet "Article Performance" report News). */
export function detectNewsViews(table: RawTable): Dataset[] | null {
  const m = findHeader<N>(table.rows, NEWS_FIELDS, ["title", "url", "views"], 40);
  if (!m) return null;
  const rows = dataRows(table, m)
    .map((r) => {
      const date = parseDate(getCell(r, m, "date"))?.date ?? null;
      return {
        path: normalizePath(str(getCell(r, m, "url"))) ?? "",
        views: parseCount(getCell(r, m, "views")) ?? 0,
        activeUsers: parseCount(getCell(r, m, "activeUsers")),
        avgEngagementTime: parseDuration(getCell(r, m, "avgEngagement")),
        _date: date,
      };
    })
    .filter((r) => r.path && r.path !== "/");
  if (!rows.length) return null;
  return [
    makeDataset("news_views", table, m, {
      month: dominantMonth(rows),
      rows,
      rowDated: true,
      warnings: ["Views diambil dari report News (sudah dihitung). Jika GA4 Pages and screens bulan ini di-import, views GA4 yang dipakai."],
    }),
  ];
}

export function detectNewsLog(table: RawTable): Dataset[] | null {
  const m = findHeader<N>(table.rows, NEWS_FIELDS, ["title", "status"], 40);
  if (!m || m.columns.views !== undefined) return null;
  if (m.columns.url === undefined && m.columns.reporter === undefined && m.columns.category === undefined) return null;
  const warnings: string[] = [];
  const rows = dataRows(table, m)
    .map((r) => {
      const title = str(getCell(r, m, "title"));
      const url = strOrNull(getCell(r, m, "url")) ?? findUrlInRow(r);
      const date = parseDate(getCell(r, m, "date"))?.date ?? null;
      return {
        date,
        submittedDate: parseDate(getCell(r, m, "submittedDate"))?.date ?? null,
        title,
        url,
        path: normalizePath(url),
        category: strOrNull(getCell(r, m, "category")),
        reporter: strOrNull(getCell(r, m, "reporter")),
        status: normalizeStatus(getCell(r, m, "status")),
        type: strOrNull(getCell(r, m, "type")),
        method: strOrNull(getCell(r, m, "method")),
        _date: date,
      };
    })
    .filter((r) => r.title && !/^\d+$/.test(r.title));
  if (!rows.length) return null;
  const noDate = rows.filter((r) => !r.date).length;
  if (noDate) warnings.push(`${noDate} baris tanpa tanggal — tetap disimpan ke bulan yang dipilih.`);
  const noUrl = rows.filter((r) => r.status === "publish" && !r.url).length;
  if (noUrl) warnings.push(`${noUrl} artikel Publish tanpa URL — tidak bisa dicocokkan ke GA4.`);
  return [makeDataset("news_log", table, m, { month: dominantMonth(rows), rows, rowDated: true, warnings })];
}

/** Format di publishing log: ambil format pertama ("Reels, Shorts" → reels). */
export function normalizeLogFormat(raw: string): string {
  const tokens = raw
    .split(/[,/+&]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return "lainnya";
  // Shorts hanya mirror dari Reels (video yang sama di YouTube Shorts) → abaikan sebagai format tersendiri.
  const first = tokens.find((t) => !/short/.test(t));
  if (!first) return "reels";
  if (/stor/.test(first)) return "story";
  if (/reel/.test(first)) return "reels";
  if (/carousel|korsel|album/.test(first)) return "carousel";
  if (/feed|foto|photo|image|gambar|single/.test(first)) return "feeds";
  if (/video/.test(first)) return "video";
  return first;
}

/** "Instagram, TikTok, Facebook" → "instagram,tiktok,facebook" (urutan dipertahankan, tanpa duplikat). */
export function normalizePlatforms(raw: string): string {
  const list = raw
    .split(/[,/+&;]|\bdan\b/i)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(normalizePlatform);
  return [...new Set(list)].join(",") || "lainnya";
}

export function detectSocialLog(table: RawTable): Dataset[] | null {
  const m = findHeader<S>(table.rows, SOCIAL_LOG_FIELDS, ["date", "format", "status"], 40);
  if (!m) return null;
  const hasPlatform = m.columns.platform !== undefined;
  if (!hasPlatform && m.columns.admin === undefined && m.columns.designer === undefined) return null;
  const warnings: string[] = [];
  if (!hasPlatform) warnings.push('Kolom Channel/Platform tidak ada — semua baris dianggap Instagram.');
  const rows = dataRows(table, m)
    .map((r) => {
      // satu baris = satu konten; kolom Channels bisa berisi beberapa platform sekaligus
      const platform = hasPlatform ? normalizePlatforms(str(getCell(r, m, "platform"))) : "instagram";
      const rawFormat = str(getCell(r, m, "format"));
      const url = strOrNull(getCell(r, m, "url")) ?? findUrlInRow(r);
      const date = parseDate(getCell(r, m, "date"))?.date ?? null;
      return {
        date,
        platform,
        format: rawFormat ? normalizeLogFormat(rawFormat) : "lainnya",
        category: strOrNull(getCell(r, m, "category")),
        admin: strOrNull(getCell(r, m, "admin")),
        designer: strOrNull(getCell(r, m, "designer")),
        status: normalizeStatus(getCell(r, m, "status")),
        title: strOrNull(getCell(r, m, "title")),
        url,
        _date: date,
      };
    })
    .filter((r) => r.format !== "lainnya" || r.title || r.date);
  if (!rows.length) return null;
  const multi = rows.filter((r) => r.platform.includes(",")).length;
  if (multi) warnings.push(`${multi} konten diposting ke beberapa channel sekaligus — tetap dihitung 1 post per baris.`);
  return [makeDataset("social_log", table, m, { month: dominantMonth(rows), rows, rowDated: true, warnings })];
}
