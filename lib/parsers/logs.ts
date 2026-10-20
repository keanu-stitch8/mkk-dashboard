// Parser log dari Google Sheets: News Content Logs, Publishing log sosmed,
// plus sheet "Article Performance" di report News (views per artikel).
import { findHeader, getCell } from "./headers";
import { dataRows, dominantMonth, findUrlInRow, makeDataset, normalizeStatus } from "./common";
import type { Dataset, RawTable } from "./types";
import { normalizePath, parseCount, parseDate, parseDuration, str, strOrNull, toMonth } from "./values";

export const NEWS_FIELDS = {
  date: ["Publish Date", "Tanggal Publish", "Tanggal Terbit", "Tanggal Tayang", "Tanggal", "Date", "Planned Date", "Tanggal Rencana"],
  /** tanggal terbit aktual (News Content Logs Google Sheets punya Planned Date + Published Date) */
  publishedDate: ["Published Date", "Actual Publish Date", "Tanggal Terbit Aktual"],
  submittedDate: ["Submitted Date", "Submitted Article Date", "Tanggal Submit", "Tanggal Kirim", "Tanggal Masuk"],
  title: ["Headline", "Judul", "Judul Artikel", "Judul Berita", "Title", "Article"],
  url: ["Article URL", "URL", "URL Artikel", "Link", "Link Artikel", "Link Berita", "Tautan"],
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
    .flatMap((r) => {
      const title = str(getCell(r, m, "title"));
      const url = strOrNull(getCell(r, m, "url")) ?? findUrlInRow(r);
      const publishedDate = parseDate(getCell(r, m, "publishedDate"))?.date ?? null;
      const submittedDate = parseDate(getCell(r, m, "submittedDate"))?.date ?? null;
      // Published Date (jika ada & terisi) didahulukan; artikel review/draft memakai Planned Date
      const date = publishedDate ?? parseDate(getCell(r, m, "date"))?.date ?? null;
      // Approved = sudah disetujui, belum tayang → dihitung in review
      const status = /^approved?$/i.test(str(getCell(r, m, "status"))) ? "review" : normalizeStatus(getCell(r, m, "status"));
      const row = {
        date,
        submittedDate,
        title,
        url,
        path: normalizePath(url),
        category: strOrNull(getCell(r, m, "category")),
        reporter: strOrNull(getCell(r, m, "reporter")),
        status,
        type: strOrNull(getCell(r, m, "type")),
        method: strOrNull(getCell(r, m, "method")),
        _date: date,
      };
      // Snapshot akhir bulan: disubmit bulan X tapi baru tayang bulan berikutnya → in review di bulan X (baris
      // tambahan) + tetap published di bulan tayang. Import per bulan hanya menyimpan baris bulannya sendiri.
      if (status === "publish" && submittedDate && publishedDate && toMonth(publishedDate)! > toMonth(submittedDate)!)
        return [row, { ...row, date: submittedDate, status: "review", _date: submittedDate }];
      return [row];
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

const TRACKER_FORMAT = /^(carousel|reels?|feeds?|video|story|stories)$/i;

export interface TrackerRow {
  format: string;
  title: string | null;
  status: string;
  /** bulan tab (dominan Planned Date) — pengganti Submitted Date yang kosong */
  tabMonth: string;
  submitted: string | null;
  published: string | null;
}

/**
 * Satu tab bulanan "Social Media - Task Progress" (tracker produksi, bukan publishing log) → baris konten.
 * Bulan tab = bulan dominan Planned Date (nama tab tanpa tahun). null jika bukan tab tracker.
 */
export function readTrackerTab(table: RawTable): { tabMonth: string; rows: TrackerRow[] } | null {
  const h = table.rows.slice(0, 10).findIndex((r) => r.some((c) => /^planned date$/i.test(str(c))) && r.some((c) => /^status$/i.test(str(c))));
  if (h < 0) return null;
  const header = table.rows[h].map((c) => str(c));
  const col = (re: RegExp) => header.findIndex((c) => re.test(c));
  // kolom Status pertama = status konten (yang kedua = status submit)
  const statusCol = col(/^status$/i);
  const dateCol = col(/^planned date$/i);
  const titleCol = col(/^(artikel|judul|title|konten)$/i);
  const submittedCol = col(/^submitted date$/i);
  const publishedCol = col(/^published date$/i);
  const data = table.rows.slice(h + 1).filter((r) => !header.every((c, i) => !c || str(r[i]) === c));
  // kolom format tidak berjudul (sel header di-merge dengan Artikel) → kolom dengan isi Carousel/Reel terbanyak
  const width = Math.max(0, ...data.map((r) => r.length));
  let formatCol = -1;
  let best = 0;
  for (let i = 0; i < width; i++) {
    const n = data.filter((r) => TRACKER_FORMAT.test(str(r[i]))).length;
    if (n > best) [formatCol, best] = [i, n];
  }
  const tabMonth = dominantMonth(data.map((r) => ({ _date: parseDate(r[dateCol])?.date ?? null })));
  if (!tabMonth) return null;
  const date = (r: (typeof data)[number], i: number) => (i >= 0 ? (parseDate(r[i])?.date ?? null) : null);
  const rows = data
    .filter((r) => str(r[statusCol]))
    .map((r) => ({
      format: formatCol >= 0 ? normalizeLogFormat(str(r[formatCol])) : "lainnya",
      title: titleCol >= 0 ? strOrNull(r[titleCol]) : null,
      status: str(r[statusCol]).toLowerCase(),
      tabMonth,
      submitted: date(r, submittedCol),
      published: date(r, publishedCol),
    }));
  return { tabMonth, rows };
}

/**
 * In review per akhir bulan (snapshot, berbasis tanggal — tidak berubah walau tracker di-update belakangan):
 * konten yang disubmit bulan ini (Submitted Date; kosong → bulan tab) dan per akhir bulan sudah diserahkan tapi
 * belum tayang: status Submitted/Reviewing/Approved, atau Published dengan Published Date setelah bulan ini.
 * Draft/In Progress/Revision (belum diserahkan) dan Unpublished/Rejected tidak dihitung.
 */
export function socialReviewDataset(rows: TrackerRow[], month: string, file: string): Dataset {
  const items = rows.filter((r) => {
    if ((toMonth(r.submitted) ?? r.tabMonth) !== month) return false;
    if (/^(submitted|review(ing)?|approved)$/.test(r.status)) return true;
    return r.status === "published" && !!r.published && toMonth(r.published)! > month;
  });
  return makeDataset("social_review", { file, blockCount: 1, rows: [], comments: [] }, null, {
    month,
    columns: [
      { field: "status", header: "Status" },
      { field: "submitted", header: "Submitted Date" },
      { field: "published", header: "Published Date" },
    ],
    metrics: [{ channel: "social", key: "social_in_review", value: items.length }],
    breakdowns: items.map((r) => ({ channel: "social" as const, dimension: "social_in_review", label: `${r.format} · ${r.title ?? "(tanpa judul)"}`, metric: "count", value: 1 })),
  });
}
