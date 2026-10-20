// Parser "MKK Internal - Youtube Calendar Timeline" — satu file untuk semua bulan (sumber log YouTube yang
// disepakati tim): tab Summary = daftar video (log published), tab Tracker = Gantt status harian per tugas.
import { dominantMonth, makeDataset, normalizeStatus, youtubeId } from "./common";
import type { Dataset, RawTable, RecordRow } from "./types";
import { parseDate, str, strOrNull, toMonth } from "./values";

/** Status Gantt yang berarti "sudah diserahkan, belum tayang" (QC = cek internal, belum diserahkan). */
const YT_REVIEW = /^(review|approved)$/i;

const findRow = (table: RawTable, test: (cells: string[]) => boolean) => table.rows.slice(0, 10).findIndex((r) => test(r.map((c) => str(c))));

/** Tab Summary → baris log YouTube (semua bulan; dipilah per bulan oleh connector lewat `_date`). */
export function readYtCalendarSummary(table: RawTable): RecordRow[] | null {
  const h = findRow(table, (c) => c.some((x) => /^publish date$/i.test(x)) && c.some((x) => /^video$/i.test(x)) && c.some((x) => /^status$/i.test(x)));
  if (h < 0) return null;
  const header = table.rows[h].map((c) => str(c));
  const col = (re: RegExp) => header.findIndex((c) => re.test(c));
  const [planned, published, video, ytTitle, url, format, category, status] = [
    col(/^planned date$/i),
    col(/^publish date$/i),
    col(/^video$/i),
    col(/^youtube title$/i),
    col(/^youtube url$/i),
    col(/^format$/i),
    col(/^category$/i),
    col(/^status$/i),
  ];
  const at = (r: unknown[], i: number) => (i >= 0 ? r[i] : null) as never;
  return table.rows
    .slice(h + 1)
    .filter((r) => str(at(r, video)) && !/^\d+$/.test(str(at(r, video))))
    .map((r) => {
      // tanggal tayang; video yang belum tayang memakai Planned Date
      const date = parseDate(at(r, published))?.date ?? parseDate(at(r, planned))?.date ?? null;
      const link = strOrNull(at(r, url));
      return {
        date,
        title: strOrNull(at(r, ytTitle)) ?? str(at(r, video)),
        url: link,
        videoId: youtubeId(link),
        format: strOrNull(at(r, format)),
        category: strOrNull(at(r, category)),
        status: normalizeStatus(at(r, status)),
        _date: date,
      };
    })
    // status Event = penanda jadwal tim berangkat event (tidak ada video), bukan konten
    .filter((r) => r.status !== "event");
}

export interface GanttVideo {
  title: string;
  /** perubahan status tugas Video Editor, urut tanggal */
  timeline: { date: string; status: string }[];
}

/**
 * Tab Tracker (Gantt): baris judul bulan (JUNE, JULY, …) + baris tanggal di atas sel status harian. Tahun tidak
 * tertulis → diambil dari Planned Date paling awal dan bertambah saat bulan kembali ke awal (Des → Jan).
 * Status video = baris tugas Video Editor.
 */
export function readYtCalendarGantt(table: RawTable): GanttVideo[] | null {
  const h = findRow(table, (c) => /^no\.?$/i.test(c[0] ?? "") && c.some((x) => /^planned date$/i.test(x)) && c.some((x) => /^task$/i.test(x)));
  if (h < 0) return null;
  const header = table.rows[h].map((c) => str(c));
  const plannedCol = header.findIndex((c) => /^planned date$/i.test(c));
  const videoCol = header.findIndex((c) => /^video$/i.test(c));
  const data = table.rows.slice(h + 3);
  const firstPlanned = data.map((r) => parseDate(r[plannedCol])?.date).filter((d): d is string => !!d).sort()[0];
  if (!firstPlanned) return null;
  const dayRow = table.rows[h + 2];
  const monthOf = (name: string) => Number(parseDate(`1 ${name} 2000`)?.date.slice(5, 7) ?? 0);
  const dates: (string | null)[] = [];
  let year = Number(firstPlanned.slice(0, 4));
  let month = 0;
  for (let i = 0; i < dayRow.length; i++) {
    const m = monthOf(str(table.rows[h][i]));
    if (m) {
      if (month && m < month) year++;
      month = m;
    }
    const day = Number(str(dayRow[i]));
    dates[i] = month && day >= 1 && day <= 31 ? (parseDate(`${day}/${month}/${year}`)?.date ?? null) : null;
  }
  const out: GanttVideo[] = [];
  let title = "";
  for (const r of data) {
    if (str(r[videoCol])) title = str(r[videoCol]);
    if (!title || !r.some((c) => /^video editor$/i.test(str(c)))) continue;
    const timeline: GanttVideo["timeline"] = [];
    r.forEach((c, i) => {
      const s = str(c).toLowerCase();
      if (dates[i] && s && timeline.at(-1)?.status !== s) timeline.push({ date: dates[i]!, status: s });
    });
    out.push({ title, timeline });
  }
  return out;
}

/**
 * In review per akhir bulan (snapshot dari Gantt): status Video Editor di hari terakhir bulan = Review/Approved,
 * dan rangkaian Review/Approved itu dimulai bulan ini (diserahkan bulan ini, belum tayang per akhir bulan).
 * Video yang masih menunggu dari bulan sebelumnya sudah dihitung di bulan penyerahannya.
 */
export function ytReviewDataset(videos: GanttVideo[], month: string, file: string): Dataset {
  const items = videos.filter((v) => {
    const upto = v.timeline.filter((t) => toMonth(t.date)! <= month);
    if (!upto.length || !YT_REVIEW.test(upto.at(-1)!.status)) return false;
    let i = upto.length - 1;
    while (i > 0 && YT_REVIEW.test(upto[i - 1].status)) i--;
    return toMonth(upto[i].date) === month;
  });
  return makeDataset("yt_review", { file, blockCount: 1, rows: [], comments: [] }, null, {
    month,
    columns: [{ field: "status", header: "Gantt · Video Editor" }],
    metrics: [{ channel: "youtube", key: "yt_in_review", value: items.length }],
    breakdowns: items.map((v) => ({ channel: "youtube" as const, dimension: "yt_in_review", label: v.title, metric: "count", value: 1 })),
  });
}

/** Dataset yt_log satu bulan dari tab Summary. */
export function ytCalendarLogDataset(rows: RecordRow[], month: string, file: string): Dataset {
  const inMonth = rows.filter((r) => toMonth(r._date ?? null) === month);
  return makeDataset("yt_log", { file, blockCount: 1, rows: [], comments: [] }, null, {
    month: dominantMonth(inMonth) ?? month,
    rowDated: true,
    rows: inMonth,
    columns: [
      { field: "date", header: "Publish Date (Planned Date jika belum tayang)" },
      { field: "title", header: "Youtube Title (Video jika kosong)" },
      { field: "url", header: "Youtube URL" },
      { field: "format", header: "Format" },
      { field: "category", header: "Category" },
      { field: "status", header: "Status" },
    ],
  });
}
