// Parser export YouTube Studio (Advanced mode: Table data, Chart data, Totals) dan publishing log YouTube.
import { findHeader, getCell, type HeaderMatch } from "./headers";
import { dataRows, dominantMonth, findUrlInRow, isTotalLabel, makeDataset, monthFromRange, normalizeStatus, sum, youtubeId } from "./common";
import type { Dataset, RawTable, SkipNotice } from "./types";
import { parseCount, parseDate, parseDuration, parseNumber, parseRate, str, strOrNull, toMonth } from "./values";
import { monthLabel } from "../month";

export const YT_FIELDS = {
  videoId: ["Content", "Konten", "Video ID", "ID Video"],
  title: ["Video title", "Judul video", "Video"],
  publishTime: ["Video publish time", "Waktu publikasi video", "Publish Date", "Tanggal publikasi", "Tanggal publish", "Published"],
  duration: ["Duration", "Durasi", "Durasi video"],
  watchHours: ["Watch time (hours)", "Waktu tonton (jam)", "Watch Time (h)", "Watch time"],
  avgViewDuration: ["Average view duration", "Durasi rata-rata dilihat", "Durasi tonton rata-rata", "Rata-rata durasi tonton", "Avg View Duration"],
  impressions: ["Impressions", "Thumbnail impressions", "Impresi", "Impresi thumbnail", "Tayangan thumbnail"],
  ctr: [
    "Impressions click-through rate (%)",
    "Thumbnail click-through rate (%)",
    "Rasio klik-tayang impresi (%)",
    "Rasio klik-tayang thumbnail (%)",
    "CTR",
  ],
  uniqueViewers: ["Unique viewers", "Penonton unik"],
  subsGained: ["Subscribers gained", "Subscriber yang diperoleh", "Subscriber diperoleh", "Subs Gained"],
  subsLost: ["Subscribers lost", "Subscriber yang hilang", "Subscriber hilang", "Subs Lost"],
  subsNet: ["Subscribers", "Subscriber"],
  views: ["Views", "Penayangan", "Jumlah penayangan"],
  date: ["Date", "Tanggal"],
} as const;

export const YT_LOG_FIELDS = {
  date: ["Publish Date", "Tanggal", "Tanggal Publish", "Tanggal Upload", "Date", "Planned Date"],
  title: ["Video", "Judul Video", "Video title"],
  url: ["URL", "Link", "Video URL", "Tautan", "Link Video"],
  format: ["Format", "Tipe", "Type", "Jenis"],
  category: ["Category", "Categories", "Kategori"],
  status: ["Status"],
} as const;

type F = keyof typeof YT_FIELDS;
type L = keyof typeof YT_LOG_FIELDS;

const COUNTS = new Set<F>(["views", "impressions", "uniqueViewers", "subsGained", "subsLost", "subsNet"]);
const num = (r: unknown[], m: HeaderMatch<F>, f: F) => (COUNTS.has(f) ? parseCount : parseNumber)(getCell(r as never, m, f));

function ctrMode(m: HeaderMatch<F>): "percent" | "auto" {
  const h = m.detected.find((d) => d.field === "ctr")?.header ?? "";
  return h.includes("%") ? "percent" : "auto";
}

export function detectYoutube(table: RawTable): Dataset[] | SkipNotice | null {
  const warnings: string[] = [];

  // Table data: per video (+ baris Total)
  let m = findHeader<F>(table.rows, YT_FIELDS, ["videoId", "views"], 5);
  if (m && (m.columns.watchHours !== undefined || m.columns.impressions !== undefined)) {
    const month = monthFromRange(table, warnings);
    const mode = ctrMode(m);
    const toRow = (r: unknown[]) => {
      const gained = num(r, m!, "subsGained");
      const lost = num(r, m!, "subsLost");
      const net = num(r, m!, "subsNet");
      return {
        videoId: str(getCell(r as never, m!, "videoId")),
        title: str(getCell(r as never, m!, "title")),
        publishedDate: parseDate(getCell(r as never, m!, "publishTime"), "mdy")?.date ?? null,
        durationSec: parseDuration(getCell(r as never, m!, "duration")),
        views: num(r, m!, "views") ?? 0,
        watchHours: num(r, m!, "watchHours"),
        avgViewDurationSec: parseDuration(getCell(r as never, m!, "avgViewDuration")),
        impressions: num(r, m!, "impressions"),
        ctr: parseRate(getCell(r as never, m!, "ctr"), mode),
        uniqueViewers: num(r, m!, "uniqueViewers"),
        subsGained: gained ?? (net !== null && net > 0 ? net : null),
        subsLost: lost,
      };
    };
    const all = dataRows(table, m);
    const totalRow = all.find((r) => isTotalLabel(getCell(r, m!, "videoId")));
    const rows = all.filter((r) => r !== totalRow && str(getCell(r, m!, "videoId"))).map(toRow);
    const metrics: Dataset["metrics"] = [];
    if (totalRow) {
      const t = toRow(totalRow);
      const keys = ["views", "watchHours", "avgViewDurationSec", "impressions", "ctr", "uniqueViewers", "subsGained", "subsLost"] as const;
      for (const k of keys) {
        const v = t[k];
        if (typeof v === "number") metrics.push({ channel: "youtube", key: k, value: v });
      }
    } else {
      warnings.push('Baris "Total" tidak ditemukan — total dihitung dari penjumlahan per video.');
    }
    if (m.columns.subsLost === undefined) warnings.push('Kolom "Subscribers lost" tidak ada — net subscriber = subscriber gained.');
    return [makeDataset("yt_table", table, m, { month, rows, metrics, warnings })];
  }

  // Totals.csv (harian) atau Chart data.csv (harian per video → diagregasi)
  m = findHeader<F>(table.rows, YT_FIELDS, ["date"], 3);
  // Chart data / Totals YouTube berisi metrik yang dipilih di grafik Studio saat export.
  // Jika metriknya bukan Watch time / Views, beri alasan yang jelas alih-alih "header tidak dikenali".
  const isDailyExport = m && (m.columns.videoId !== undefined || /(^|\/)(totals|chart data)[^/]*\.csv$/i.test(table.file));
  if (m && isDailyExport && m.columns.watchHours === undefined && m.columns.views === undefined && m.columns.impressions === undefined) {
    const header = (table.rows[m.headerRow] ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
    const metric = header.at(-1) ?? "?";
    return {
      skip: `Grafik harian YouTube berisi metrik "${metric}", bukan Watch time — dilewati. Untuk grafik watch time harian: di YouTube Studio (Advanced mode) pilih metrik Watch time (hours) pada grafik, lalu export ulang.`,
    };
  }
  if (m && (m.columns.watchHours !== undefined || m.columns.views !== undefined) && m.columns.impressions === undefined) {
    const perVideo = m.columns.videoId !== undefined;
    const byDate = new Map<string, { watchHours: number | null; views: number | null }>();
    for (const r of dataRows(table, m)) {
      const d = parseDate(getCell(r, m, "date"))?.date;
      if (!d) continue;
      const cur = byDate.get(d) ?? { watchHours: null, views: null };
      const wh = num(r, m, "watchHours");
      const v = num(r, m, "views");
      if (wh !== null) cur.watchHours = (cur.watchHours ?? 0) + wh;
      if (v !== null) cur.views = (cur.views ?? 0) + v;
      byDate.set(d, cur);
    }
    if (!byDate.size) return null;
    const rows = [...byDate.entries()].sort().map(([date, v]) => ({ date, ...v, _date: date }));
    return [
      makeDataset("yt_daily", table, m, {
        month: monthFromRange(table, warnings) ?? dominantMonth(rows),
        rows,
        rowDated: true,
        priority: perVideo ? 1 : 2,
        warnings,
      }),
    ];
  }

  // Publishing log YouTube
  const lm = findHeader<L>(table.rows, YT_LOG_FIELDS, ["title", "status"], 40);
  if (lm) {
    const rows = dataRows(table, lm)
      .map((r) => {
        const title = str(getCell(r, lm, "title"));
        const url = strOrNull(getCell(r, lm, "url")) ?? findUrlInRow(r, /youtu\.?be/i);
        const date = parseDate(getCell(r, lm, "date"))?.date ?? null;
        return {
          date,
          title,
          url,
          videoId: youtubeId(url),
          format: strOrNull(getCell(r, lm, "format")),
          category: strOrNull(getCell(r, lm, "category")),
          status: normalizeStatus(getCell(r, lm, "status")),
          _date: date,
        };
      })
      .filter((r) => r.title && !/^\d+$/.test(r.title));
    if (!rows.length) return null;
    const columns = lm.detected.map((d) => ({ field: d.field, header: d.header }));
    if (lm.columns.url === undefined && rows.some((r) => r.url)) columns.push({ field: "url", header: "(kolom tanpa header berisi link YouTube)" });
    const ds = makeDataset("yt_log", table, lm, { month: dominantMonth(rows), rows, rowDated: true, warnings });
    ds.columns = columns;
    return [ds];
  }
  return null;
}


/**
 * Definisi laporan YouTube: bulan X = video yang dipublish di bulan X, dengan performa selama bulan X
 * (sama seperti report News). Video yang dipublish di bulan lain dibuang dan total dihitung ulang.
 */
export function applyPublishCohort(ds: Dataset, month: string): Dataset {
  const pubMonth = (r: Dataset["rows"][number]) => toMonth(typeof r.publishedDate === "string" ? r.publishedDate : null);
  const keep = ds.rows.filter((r) => !pubMonth(r) || pubMonth(r) === month);
  if (keep.length === ds.rows.length) return ds;

  const dropped = ds.rows.filter((r) => !keep.includes(r));
  const counts = new Map<string, number>();
  for (const r of dropped) counts.set(pubMonth(r)!, (counts.get(pubMonth(r)!) ?? 0) + 1);
  const detail = [...counts.entries()].sort().map(([m, n]) => `${n} video publish ${monthLabel(m)}`).join(", ");
  const warnings = [
    ...ds.warnings,
    `${dropped.length} video tidak dihitung (${detail}) — laporan YouTube ${monthLabel(month)} hanya memuat video yang dipublish ${monthLabel(month)}.`,
  ];
  if (!keep.length) {
    warnings.push(`Tidak ada video yang dipublish ${monthLabel(month)} di file ini — dataset ini tidak akan disimpan.`);
    return { ...ds, rows: [], metrics: [], warnings };
  }

  const total = (k: string) => sum(keep.map((r) => (typeof r[k] === "number" ? (r[k] as number) : null)));
  const views = total("views");
  const watchHours = total("watchHours");
  const impressions = total("impressions");
  const metrics: Dataset["metrics"] = [
    { channel: "youtube", key: "views", value: views },
    { channel: "youtube", key: "watchHours", value: watchHours },
    { channel: "youtube", key: "impressions", value: impressions },
    { channel: "youtube", key: "subsGained", value: total("subsGained") },
  ];
  if (impressions) metrics.push({ channel: "youtube", key: "ctr", value: sum(keep.map((r) => Number(r.ctr ?? 0) * Number(r.impressions ?? 0))) / impressions });
  if (views) metrics.push({ channel: "youtube", key: "avgViewDurationSec", value: (watchHours * 3600) / views });
  if (keep.some((r) => typeof r.subsLost === "number")) metrics.push({ channel: "youtube", key: "subsLost", value: total("subsLost") });
  warnings.push("Total dihitung ulang dari video yang tersisa (unique viewers tidak bisa dijumlah, jadi dikosongkan). Grafik harian (Totals.csv) masih memuat semua video di file.");
  return { ...ds, rows: keep, metrics, warnings };
}
