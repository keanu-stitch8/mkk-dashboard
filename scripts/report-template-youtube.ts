// Master template laporan YouTube. Dasarnya SALINAN master template News (gaya yang sudah disamakan user untuk semua
// laporan), lalu diubah ke isi YouTube. Laporan contoh YouTube user hanya dipakai sebagai acuan isi (tidak disentuh).
// npx tsx scripts/report-template-youtube.ts --from=<ID master template News>  → template baru (DRAFT)
// npx tsx scripts/report-template-youtube.ts --patch=<ID template>             → perbarui teks/format template yang ada
// npx tsx scripts/report-template-youtube.ts --fit-widths=<ID template>        → samakan lebar kolom semua sheet (PDF penuh)
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { ReportClients } from "../lib/reports/engine/sheets";
import type { RowStyleSpec } from "../lib/reports/engine/template-tools";

type Req = Record<string, unknown>;

const ES = "01 Executive Summary";
const VP = "02 Video Performance";
const PL = "03 Publishing Log";
const MG = "04 Metric Guide";

const tokens = (t: string, cols: string[]) => cols.map((k) => `{{#${t}.${k}}}`);

// Teks laporan untuk client: kalimat pendek & lugas, tanpa jargon (posisi akhir template).
const GUIDE: [string, string, string][] = [
  ["Videos published", "Videos in the YouTube Publishing Log with Publish status for the month, including recap videos.", "Shows the videos that went live."],
  ["Videos in review", "Videos submitted for review this month and still waiting for approval at the end of the month, from the production tracker.", "Shows work that is finished but not yet live."],
  ["Delivered vs quota", "Videos published plus videos in review, against the planned number of videos for the month. Quota achievement is delivered divided by the quota.", "Measures delivery against the quota."],
  ["Views", "YouTube views of the videos published this month, counted for {{period}}.", "Main measure of reach."],
  ["Views per video", "Views divided by the number of published videos.", "Compares months with different output."],
  ["Unique viewers", "Estimated number of different people who watched a video.", "Shows reach per video. One person can watch several videos, so do not add them up."],
  ["Watch time (hours)", "Total time viewers spent watching.", "Shows depth of viewing, not just clicks."],
  ["Avg view duration", "Average time watched per view.", "Best read together with the length of the video."],
  ["Impressions and CTR", "Times a video thumbnail was shown on YouTube, and the share of those that led to a view (CTR).", "Shows how widely YouTube recommended the video and how well the title and thumbnail work. A CTR below 4% suggests they may need work."],
  ["Subscribers (net)", "Subscribers gained from the videos minus subscribers lost.", "Shows which videos helped grow the channel."],
  ["Share of views", "A video's views divided by the views of all videos in this report.", "Shows which videos carried the month."],
  ["Production series", "Videos from one shoot, released over several months. Recap videos are a separate production and are not counted in the series.", "Tracks how much of the produced content has been released."],
  ["Month-on-month", "KPI cards compare with {{prev_month_label}}.", "Green marks an improvement and red a decline."],
];

/** Kartu KPI (urutan YOUTUBE_KPIS) → [baris label (1-based), kolom awal (0-based), format angka nilai] */
const CARDS: [string, number, number, [string, string] | null][] = [
  ["delivered", 4, 0, null],
  ["views", 4, 3, ["NUMBER", "#,##0"]],
  ["views_per_video", 4, 6, ["NUMBER", "#,##0"]],
  ["impressions", 4, 9, ["NUMBER", "#,##0"]],
  ["ctr", 9, 0, ["PERCENT", "0.00%"]],
  ["watch_hours", 9, 3, ["NUMBER", "#,##0.0"]],
  ["avg_view_duration", 9, 6, null],
  ["subs_net", 9, 9, null],
];

const TEXT: Record<string, Record<string, string | string[]>> = {
  [ES]: {
    A1: "MAIN KE KUDUS | YOUTUBE MONTHLY PERFORMANCE REPORT - {{month_label}}",
    A2: "Reporting period: {{period}} · Sources: YouTube Analytics and the YouTube Publishing Log",
    ...Object.fromEntries(
      CARDS.flatMap(([k, r, c0]) => {
        const col = String.fromCharCode(65 + c0);
        return [[`${col}${r}`, `{{kpi.${k}.label}}`], [`${col}${r + 1}`, `{{kpi.${k}.value}}`], [`${col}${r + 2}`, `{{kpi.${k}.change}}`]];
      }),
    ),
    A14: "TOP PERFORMING VIDEO",
    A15: "{{top.title}}",
    I15: "VIEWS",
    K15: "SHARE OF VIEWS",
    I16: "{{top.views}}",
    K16: "{{top.share}}",
    A20: "KEY FINDINGS",
    A21: "{{#findings.text}}",
    // seri produksi: video dari satu kali syuting, dipublish bertahap (recap = produksi terpisah)
    A24: "PRODUCTION SERIES · {{series.name}}",
    A25: ["SHOOT PERIOD", "", "VIDEOS PRODUCED", "", "{{series.before_label}}", "", "{{series.month_label}}", "", "REMAINING", "", "RECAPS THIS MONTH", ""],
    A26: ["{{series.shoot}}", "", "{{series.produced}}", "", "{{series.before}}", "", "{{series.month}}", "", "{{series.remaining}}", "", "{{recaps}}", ""],
    A29: "CONTENT BREAKDOWN",
    A44: "CONTENT TYPE",
    H44: "CONTENT CATEGORY",
    A45: ["Content Type", "", "Published", "Share of Published", "", "", "", "Category", "", "Videos", "Share of Quota"],
    ...Object.fromEntries([1, 2, 3].map((i) => [`A${45 + i}`, [`{{type.${i}.name}}`, "", `{{type.${i}.count}}`, `{{type.${i}.share}}`]])),
    // 9 kategori taksonomi (YT_CATEGORY_SLOTS, tanpa Other; slot 9 = Transportation disisipkan 2026-10-21)
    ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`H${46 + i}`, [`{{cat.${i + 1}.name}}`, "", `{{cat.${i + 1}.count}}`, `{{cat.${i + 1}.share}}`]])),
    // In review disisipkan 2026-10-20 (ensureReviewRow): delivered = published + in review, sama dengan News
    H55: ["In review", "", "{{cat.review}}", "{{cat.review_share}}"],
    H56: ["Unpublished", "", "{{cat.unpublished}}", "{{cat.unpublished_share}}"],
    H57: ["Monthly Quota", "", "{{cat.quota}}", "100.0%"],
    A60: "Views, watch time and subscribers come from YouTube Analytics for {{period}}. Each video in the Publishing Log is matched by its video link.",
  },
  [VP]: {
    A1: "YOUTUBE VIDEO PERFORMANCE",
    A3: "Videos published in {{month_label}} and their YouTube Analytics results for {{period}}.",
    A5: ["No.", "Publish Date", "Video", "Type", "Category", "Views", "Unique Viewers", "Watch Time (h)", "Avg View Duration", "Impressions", "CTR", "Subs Gained", "Share of Views"],
    A6: tokens("videos", ["no", "date", "title", "type", "category", "views", "unique", "watch", "avd", "impressions", "ctr", "subs", "share"]),
    A7: ["", "", "TOTAL ({{listed}} videos)", "", "", "{{videos.total_views}}", "{{videos.total_unique}}", "{{videos.total_watch}}", "{{videos.total_avd}}", "{{videos.total_impressions}}", "{{videos.total_ctr}}", "{{videos.total_subs}}", "100.0%"],
  },
  // strip angka = definisi dashboard: delivered = published + in review, achievement = delivered ÷ kuota, sisa = kuota − delivered
  [PL]: {
    A1: "PUBLISHING LOG · {{month_upper}}",
    A3: "Videos published on YouTube in {{month_label}}, followed by videos still in review at the end of the month",
    A5: ["DELIVERED", "", "MONTHLY QUOTA", "", "QUOTA ACHIEVEMENT", "", "REMAINING QUOTA"],
    A6: ["{{delivered}}", "", "{{quota}}", "", "{{achievement}}", "", "{{remaining}}"],
    A9: ["No.", "Publish Date", "Video", "Video URL", "Type", "Category", "Production", "Status"],
    A10: tokens("log", ["no", "date", "title", "url", "type", "category", "production", "status"]),
  },
  [MG]: {
    A1: "METRIC GUIDE",
    A3: "How the figures in this report are defined",
    ...Object.fromEntries(GUIDE.map((g, i) => [`A${6 + i}`, g])),
    A21: "REPORTING METHODOLOGY",
    A22: "Videos come from the YouTube Publishing Log; videos in review come from the production tracker. Views, watch time, impressions and subscribers come from YouTube Analytics for {{period}}, matched to each video by its link. Figures are final once the month is closed.",
  },
};

/** Peran baris tiap sheet (posisi template) → tinggi, huruf, warna standar semua laporan (ROW_STYLE). */
const STYLE: RowStyleSpec = {
  [ES]: [
    ["reportTitle", 1],
    ["subtitle", 2],
    // 1 baris spasi setelah subjudul (r3; baris spasi kedua dihapus user 2026-10-20 di semua laporan)
    ["autoFit", 3],
    ...[4, 9].flatMap((r): RowStyleSpec[string] => [["cardLabel", r], ["cardValue", r + 1], ["cardLabel", r + 2]]),
    ["section", 14],
    ["section", 20],
    ["text", 21],
    ["section", 24],
    ["cardLabel", 25],
    ["cardValue", 26],
    ["section", 29],
    ["section", 44],
    ["header", 45],
    ["row", [46, 58]],
    ["total", 49, [1, 5]],
    ["total", 59],
    ["note", 62],
  ],
  [VP]: [["sheetTitle", 1], ["subtitle", 3], ["header", 5], ["row", 6], ["total", 7, [1, 13]]],
  [PL]: [["sheetTitle", 1], ["subtitle", 3], ["cardLabel", 5], ["cardValue", 6], ["header", 9], ["row", 10]],
  [MG]: [["sheetTitle", 1], ["subtitle", 3], ["header", 5], ["text", [6, 18]], ["section", 21], ["text", 22]],
};

/** Teks penanda di posisi yang dipakai TEXT & STYLE; layout berubah (template diedit) → patch berhenti. */
const ANCHORS: Record<string, string> = {
  [`'${ES}'!A14`]: "TOP PERFORMING VIDEO",
  [`'${ES}'!A20`]: "KEY FINDINGS",
  [`'${ES}'!A29`]: "CONTENT BREAKDOWN",
  [`'${ES}'!A45`]: "Content Type",
  [`'${ES}'!H57`]: "Monthly Quota",
  [`'${VP}'!A5`]: "No.",
  [`'${PL}'!A9`]: "No.",
  [`'${MG}'!A5`]: "Metric",
  [`'${MG}'!A21`]: "REPORTING METHODOLOGY",
};

async function sheetIds(c: ReportClients, id: string) {
  const meta = await c.sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets(properties(sheetId,title))" });
  return (title: string) => meta.data.sheets!.find((x) => x.properties!.title === title)!.properties!.sheetId!;
}

/** Tulis TEXT, lalu format angka (menulis teks ke sel mereset format angkanya → format selalu dipasang sesudahnya). */
async function patchText(c: ReportClients, id: string) {
  const data = Object.entries(TEXT).flatMap(([sheet, cells]) =>
    Object.entries(cells).map(([a1, v]) => ({ range: `'${sheet.replace(/'/g, "''")}'!${a1}`, values: [Array.isArray(v) ? v : [v]] })),
  );
  await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data } });
  const sid = await sheetIds(c, id);
  const range = (sheet: string, r1: number, c0: number, c1: number, r2 = r1) => ({ sheetId: sid(sheet), startRowIndex: r1 - 1, endRowIndex: r2, startColumnIndex: c0, endColumnIndex: c1 });
  const num = (sheet: string, r1: number, c0: number, c1: number, [type, pattern]: readonly [string, string], r2 = r1, align?: "RIGHT"): Req => ({
    repeatCell: {
      range: range(sheet, r1, c0, c1, r2),
      cell: { userEnteredFormat: { numberFormat: { type, pattern }, ...(align ? { horizontalAlignment: align } : {}) } },
      fields: align ? "userEnteredFormat(numberFormat,horizontalAlignment)" : "userEnteredFormat.numberFormat",
    },
  });
  const INT = ["NUMBER", "#,##0"] as const;
  const PCT1 = ["PERCENT", "0.0%"] as const;
  const PCT2 = ["PERCENT", "0.00%"] as const;
  const DEC1 = ["NUMBER", "#,##0.0"] as const;
  const TXT = ["TEXT", "@"] as const;
  const DATE = ["DATE", "dd mmm yyyy"] as const;
  const right = (sheet: string, r1: number, c0: number, c1: number, r2 = r1): Req => ({
    repeatCell: { range: range(sheet, r1, c0, c1, r2), cell: { userEnteredFormat: { horizontalAlignment: "RIGHT" } }, fields: "userEnteredFormat.horizontalAlignment" },
  });
  const requests: Req[] = [
    ...CARDS.map(([, r, c0, f]) => num(ES, r + 1, c0, c0 + 3, f ?? TXT)),
    num(ES, 16, 8, 10, INT),
    num(ES, 16, 10, 12, PCT1),
    num(ES, 26, 0, 12, INT),
    num(ES, 26, 0, 2, TXT),
    num(ES, 46, 2, 3, INT, 49, "RIGHT"),
    num(ES, 46, 3, 5, PCT1, 49, "RIGHT"),
    num(ES, 46, 9, 10, INT, 59, "RIGHT"),
    num(ES, 46, 10, 12, PCT1, 59, "RIGHT"),
    right(ES, 45, 2, 5),
    right(ES, 45, 9, 12),
    num(VP, 6, 1, 2, DATE),
    num(VP, 6, 5, 7, INT, 7, "RIGHT"),
    num(VP, 6, 7, 8, DEC1, 7, "RIGHT"),
    right(VP, 6, 8, 9, 7),
    num(VP, 6, 9, 10, INT, 7, "RIGHT"),
    num(VP, 6, 10, 11, PCT2, 7, "RIGHT"),
    num(VP, 6, 11, 12, INT, 7, "RIGHT"),
    num(VP, 6, 12, 13, PCT1, 7, "RIGHT"),
    right(VP, 5, 5, 13),
    num(PL, 6, 0, 4, INT),
    num(PL, 6, 4, 6, PCT1),
    num(PL, 6, 6, 8, INT),
    num(PL, 10, 1, 2, DATE),
  ];
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
}

/**
 * Salinan master News → struktur YouTube (sekali, saat --from). Hasilnya = layout master YouTube yang disetujui user
 * 2026-10-20 (posisi TEXT/STYLE/ANCHORS di atas). Posisi sumber = master News saat itu.
 */
async function restructure(c: ReportClients, id: string) {
  const sid = await sheetIds(c, id);
  const requests: Req[] = [
    { deleteSheet: { sheetId: sid("04 Articles Under Review") } },
    { updateSheetProperties: { properties: { sheetId: sid("02 Article Performance"), title: VP }, fields: "title" } },
    { updateSheetProperties: { properties: { sheetId: sid("05 Metric Guide"), title: MG }, fields: "title" } },
  ];
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
  // ID sheet sesudah ganti nama
  const s2 = await sheetIds(c, id);
  const r2 = (sheet: string, r1: number, c0: number, c1: number, rEnd = r1) => ({ sheetId: s2(sheet), startRowIndex: r1 - 1, endRowIndex: rEnd, startColumnIndex: c0, endColumnIndex: c1 });
  const ROWS = (sheet: string, from1: number, to1: number) => ({ sheetId: s2(sheet), dimension: "ROWS", startIndex: from1 - 1, endIndex: to1 });
  const COLS = (sheet: string, c0: number, c1: number) => ({ sheetId: s2(sheet), dimension: "COLUMNS", startIndex: c0, endIndex: c1 });
  const pairs = (r1: number) => [0, 2, 4, 6, 8, 10].map((c0) => ({ mergeCells: { range: r2(ES, r1, c0, c0 + 2), mergeType: "MERGE_ALL" } }));
  await c.sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [
        // 01: blok seri produksi (5 baris: spasi, bar, label, nilai, spasi) setelah Key Findings → baris di bawahnya turun 5
        { insertDimension: { range: ROWS(ES, 23, 27), inheritFromBefore: false } },
        // kategori News 15 + "Under review" → YouTube 11 kategori (+ Unpublished, Monthly Quota tetap); di dalam
        // rentang pie chart sehingga rentangnya ikut menyusut
        { deleteDimension: { range: ROWS(ES, 57, 61) } },
        // strip seri = gaya strip angka 03 Publishing Log (label kecil + angka besar), 6 sel × 2 kolom
        { copyPaste: { source: r2(PL, 5, 0, 2), destination: r2(ES, 25, 0, 12), pasteType: "PASTE_FORMAT" } },
        { copyPaste: { source: r2(PL, 6, 0, 2), destination: r2(ES, 26, 0, 12), pasteType: "PASTE_FORMAT" } },
        // nilai strip 03 di-merge 2 baris (r6:r7) → bersihkan sampai r27 sebelum merge per pasang kolom
        { unmergeCells: { range: r2(ES, 25, 0, 12, 27) } },
        ...pairs(25),
        ...pairs(26),
        // 02: 10 → 13 kolom (Watch time, Impressions, CTR, Subs, Share), format ikut kolom terakhir
        { insertDimension: { range: COLS(VP, 10, 13), inheritFromBefore: true } },
        // 03: kolom Method dihapus (9 → 8 kolom)
        { deleteDimension: { range: COLS(PL, 8, 9) } },
        // lebar awal (fitWidths menskalakan ke lebar halaman)
        ...[32, 80, 266, 100, 104, 52, 60, 60, 68, 76, 54, 56, 79].map((px, i) => ({ updateDimensionProperties: { range: COLS(VP, i, i + 1), properties: { pixelSize: px }, fields: "pixelSize" } })),
        ...[41, 80, 300, 260, 110, 100, 150, 70].map((px, i) => ({ updateDimensionProperties: { range: COLS(PL, i, i + 1), properties: { pixelSize: px }, fields: "pixelSize" } })),
      ],
    },
  });
}

async function main() {
  const { reportClients, copyFile } = await import("../lib/reports/engine/sheets");
  const { applyRowStyles, assertAnchors, ensureReviewRow, fitWidths } = await import("../lib/reports/engine/template-tools");
  const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const c = await reportClients();
  if (arg("fit-widths")) return fitWidths(c, arg("fit-widths")!);
  if (arg("patch")) {
    await ensureReviewRow(c, arg("patch")!, ES, 57);
    await assertAnchors(c, arg("patch")!, ANCHORS);
    await patchText(c, arg("patch")!);
    await applyRowStyles(c, arg("patch")!, STYLE);
    await fitWidths(c, arg("patch")!);
    return console.log(`Template diperbarui: https://docs.google.com/spreadsheets/d/${arg("patch")}/edit`);
  }
  const from = arg("from");
  if (!from) throw new Error("--from=<ID master template News> (buat template baru) atau --patch=<ID template> wajib");
  const file = await copyFile(c, from, "DRAFT – TEMPLATE – MKK YouTube Monthly Performance Report");
  await restructure(c, file.id);
  await ensureReviewRow(c, file.id, ES, 57);
  await patchText(c, file.id);
  await assertAnchors(c, file.id, ANCHORS);
  await applyRowStyles(c, file.id, STYLE);
  await fitWidths(c, file.id);
  console.log(`Template YouTube (DRAFT): ${file.url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
