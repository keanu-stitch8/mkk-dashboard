// Master template laporan Social Media (Instagram). Dasarnya SALINAN master template YouTube (layout yang sudah
// disetujui user, gaya sama untuk semua laporan), lalu diubah ke isi Instagram. Laporan contoh Social user hanya acuan isi.
// npx tsx scripts/report-template-social.ts --from=<ID master template YouTube>  → template baru (DRAFT)
// npx tsx scripts/report-template-social.ts --patch=<ID template>                → perbarui teks/format template yang ada
// npx tsx scripts/report-template-social.ts --fit-widths=<ID template>           → samakan lebar kolom semua sheet (PDF penuh)
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { ReportClients } from "../lib/reports/engine/sheets";
import type { RowStyleSpec } from "../lib/reports/engine/template-tools";

type Req = Record<string, unknown>;

const ES = "01 Executive Summary";
const PP = "02 Post Performance";
const PL = "03 Publishing Log";
const MG = "04 Metric Guide";

const tokens = (t: string, cols: string[]) => cols.map((k) => `{{#${t}.${k}}}`);

// Teks laporan untuk client: kalimat pendek & lugas, tanpa jargon (posisi akhir template).
const GUIDE: [string, string, string][] = [
  ["Posts published", "Entries in the Social Media Publishing Log with Publish status for the month, all formats including Stories.", "Shows the content that went live."],
  ["Posts in review", "Content submitted this month and still waiting for approval at the end of the month, from the Social Media Task Progress tracker.", "Shows work that is finished but not yet live."],
  ["Delivered vs quota", "Posts published plus posts in review, against the planned number of posts for the month. Quota achievement is delivered divided by the quota.", "Measures delivery against the quota."],
  ["Views", "Times Instagram content was shown during {{period}}, from Instagram account insights. Includes Stories and older posts.", "Main measure of visibility."],
  ["Views per post", "Lifetime views of the feed posts and Reels published this month, divided by their number.", "Shows how this month's posts performed."],
  ["Reach", "Number of different accounts that saw the content during the month.", "Shows how many people the account reached."],
  ["Interactions", "Likes, comments, shares, saves and replies during the month.", "Shows how actively people responded."],
  ["Engagement rate", "Interactions divided by reach.", "Compares engagement across months of different size."],
  ["Follows", "New followers of the account during the month.", "Shows audience growth."],
  ["Active publishing days", "Days with at least one post.", "Shows how steady the posting rhythm was."],
  ["Post table figures", "Lifetime totals per post since publishing, as of the report date.", "Posts keep collecting views, so these figures can grow after the month ends."],
  ["Format and category", "Format (Feeds for photo and carousel posts, Reels, Stories, Videos) and topic group of each post, from the Publishing Log.", "Shows the balance of formats and topics."],
  ["Month-on-month", "KPI cards compare with {{prev_month_label}}.", "Green marks an improvement and red a decline."],
];

/** Kartu KPI (urutan SOCIAL_KPIS) → [baris label (1-based), kolom awal (0-based), format angka nilai] */
const CARDS: [string, number, number, [string, string] | null][] = [
  ["delivered", 4, 0, null],
  ["views", 4, 3, ["NUMBER", "#,##0"]],
  ["views_per_post", 4, 6, ["NUMBER", "#,##0"]],
  ["reach", 4, 9, ["NUMBER", "#,##0"]],
  ["engagement_rate", 9, 0, ["PERCENT", "0.00%"]],
  ["interactions", 9, 3, ["NUMBER", "#,##0"]],
  ["follows", 9, 6, ["NUMBER", "#,##0"]],
  ["active_days", 9, 9, null],
];
const FORMAT_SLOTS = 4;
const CATEGORY_SLOTS = 8; // 8 pilar konten (SOC_CATEGORY_SLOTS, tanpa Other — baris Other dihapus 2026-10-21)

const TEXT: Record<string, Record<string, string | string[]>> = {
  [ES]: {
    A1: "MAIN KE KUDUS | SOCIAL MEDIA MONTHLY PERFORMANCE REPORT - {{month_label}}",
    A2: "Reporting period: {{period}} · Sources: Instagram Insights and the Social Media Publishing Log",
    ...Object.fromEntries(
      CARDS.flatMap(([k, r, c0]) => {
        const col = String.fromCharCode(65 + c0);
        return [[`${col}${r}`, `{{kpi.${k}.label}}`], [`${col}${r + 1}`, `{{kpi.${k}.value}}`], [`${col}${r + 2}`, `{{kpi.${k}.change}}`]];
      }),
    ),
    A14: "TOP PERFORMING POST",
    A15: "{{top.title}}",
    I15: "VIEWS",
    K15: "REACH",
    I16: "{{top.views}}",
    K16: "{{top.reach}}",
    A20: "KEY FINDINGS",
    A21: "{{#findings.text}}",
    A24: "CONTENT BREAKDOWN",
    A39: "CONTENT FORMAT",
    H39: "CONTENT CATEGORY",
    A40: ["Format", "", "Published", "Share of Published", "", "", "", "Category", "", "Posts", "Share of Quota"],
    ...Object.fromEntries(Array.from({ length: FORMAT_SLOTS }, (_, i) => [`A${41 + i}`, [`{{fmt.${i + 1}.name}}`, "", `{{fmt.${i + 1}.count}}`, `{{fmt.${i + 1}.share}}`]])),
    A45: ["Published Total", "", "{{formats.total}}", "100.0%"],
    ...Object.fromEntries(Array.from({ length: CATEGORY_SLOTS }, (_, i) => [`H${41 + i}`, [`{{cat.${i + 1}.name}}`, "", `{{cat.${i + 1}.count}}`, `{{cat.${i + 1}.share}}`]])),
    // In review disisipkan 2026-10-20 (ensureReviewRow): delivered = published + in review, sama dengan News
    H49: ["In review", "", "{{cat.review}}", "{{cat.review_share}}"],
    H50: ["Unpublished", "", "{{cat.unpublished}}", "{{cat.unpublished_share}}"],
    H51: ["Monthly Quota", "", "{{cat.quota}}", "100.0%"],
    A54: "Account figures (views, reach, interactions, follows) cover all Instagram activity during {{period}}, including Stories and older posts. Post figures are lifetime totals for the posts published this month.",
  },
  [PP]: {
    A1: "INSTAGRAM POST PERFORMANCE",
    A3: "Feed posts and Reels published in {{month_label}}, with lifetime results from Instagram Insights.",
    A5: ["No.", "Publish Date", "Post", "Format", "Category", "Reach", "Views", "Follows", "Interactions", "Likes", "Comments", "Shares", "Saves"],
    A6: tokens("posts", ["no", "date", "title", "format", "category", "reach", "views", "follows", "interactions", "likes", "comments", "shares", "saves"]),
    A7: ["", "", "TOTAL ({{listed}} posts)", "", "", "{{posts.total_reach}}", "{{posts.total_views}}", "{{posts.total_follows}}", "{{posts.total_interactions}}", "{{posts.total_likes}}", "{{posts.total_comments}}", "{{posts.total_shares}}", "{{posts.total_saves}}"],
  },
  // strip angka = definisi dashboard: delivered = published + in review, achievement = delivered ÷ kuota, sisa = kuota − delivered
  [PL]: {
    A1: "PUBLISHING LOG · {{month_upper}}",
    A3: "Content published in {{month_label}}, one entry per piece of content across all channels, followed by content still in review at the end of the month",
    A5: ["DELIVERED", "", "MONTHLY QUOTA", "", "QUOTA ACHIEVEMENT", "", "REMAINING QUOTA"],
    A6: ["{{delivered}}", "", "{{quota}}", "", "{{achievement}}", "", "{{remaining}}"],
    A9: ["No.", "Publish Date", "Content", "Link", "Category", "Channels", "Format", "Status"],
    A10: tokens("log", ["no", "date", "title", "url", "category", "channels", "format", "status"]),
  },
  [MG]: {
    A1: "METRIC GUIDE",
    A3: "How the figures in this report are defined",
    ...Object.fromEntries(GUIDE.map((g, i) => [`A${6 + i}`, g])),
    A21: "REPORTING METHODOLOGY",
    A22: "Posts come from the monthly Social Media Publishing Log, one entry per piece of content even when it is shared to several channels. Posts in review come from the Social Media Task Progress tracker. Performance figures cover Instagram only and come from Instagram Insights for {{period}}.",
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
    ["section", 39],
    ["header", 40],
    ["row", [41, 51]],
    ["total", 45, [1, 5]],
    ["total", 52],
    ["note", 55],
  ],
  [PP]: [["sheetTitle", 1], ["subtitle", 3], ["header", 5], ["row", 6], ["total", 7, [1, 13]]],
  [PL]: [["sheetTitle", 1], ["subtitle", 3], ["cardLabel", 5], ["cardValue", 6], ["header", 9], ["row", 10]],
  [MG]: [["sheetTitle", 1], ["subtitle", 3], ["header", 5], ["text", [6, 18]], ["section", 21], ["text", 22]],
};

/** Teks penanda di posisi yang dipakai TEXT & STYLE; layout berubah (template diedit) → patch berhenti. */
const ANCHORS: Record<string, string> = {
  [`'${ES}'!A14`]: "TOP PERFORMING POST",
  [`'${ES}'!A20`]: "KEY FINDINGS",
  [`'${ES}'!A24`]: "CONTENT BREAKDOWN",
  [`'${ES}'!A40`]: "Format",
  [`'${ES}'!H51`]: "Monthly Quota",
  [`'${PP}'!A5`]: "No.",
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
  const TXT = ["TEXT", "@"] as const;
  const DATE = ["DATE", "dd mmm yyyy"] as const;
  const right = (sheet: string, r1: number, c0: number, c1: number, r2 = r1): Req => ({
    repeatCell: { range: range(sheet, r1, c0, c1, r2), cell: { userEnteredFormat: { horizontalAlignment: "RIGHT" } }, fields: "userEnteredFormat.horizontalAlignment" },
  });
  const requests: Req[] = [
    ...CARDS.map(([, r, c0, f]) => num(ES, r + 1, c0, c0 + 3, f ?? TXT)),
    num(ES, 16, 8, 12, INT),
    num(ES, 41, 2, 3, INT, 45, "RIGHT"),
    num(ES, 41, 3, 5, PCT1, 45, "RIGHT"),
    num(ES, 41, 9, 10, INT, 52, "RIGHT"),
    num(ES, 41, 10, 12, PCT1, 52, "RIGHT"),
    right(ES, 40, 2, 5),
    right(ES, 40, 9, 12),
    num(PP, 6, 1, 2, DATE),
    num(PP, 6, 5, 13, INT, 7, "RIGHT"),
    right(PP, 5, 5, 13),
    num(PL, 6, 0, 4, INT),
    num(PL, 6, 4, 6, PCT1),
    num(PL, 6, 6, 8, INT),
    num(PL, 10, 1, 2, DATE),
  ];
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
}

/**
 * Salinan master YouTube → struktur Social (sekali, saat --from). Posisi sumber = master YouTube yang disetujui
 * user 2026-10-20 (Production Series r24–r28, tipe r47–r49, kategori r47–r57, Unpublished r58).
 */
async function restructure(c: ReportClients, id: string) {
  const sid0 = await sheetIds(c, id);
  await c.sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: sid0("02 Video Performance"), title: PP }, fields: "title" } }] },
  });
  const sid = await sheetIds(c, id);
  const ROWS = (sheet: string, from1: number, to1: number) => ({ sheetId: sid(sheet), dimension: "ROWS", startIndex: from1 - 1, endIndex: to1 });
  await c.sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [
        // seri produksi (khusus YouTube) dihapus → baris di bawahnya naik 5
        { deleteDimension: { range: ROWS(ES, 23, 27) } },
        // tipe 3 → 4 format: sisip 1 baris sebelum "Published Total" (r45), format ikut baris tipe di atasnya
        { insertDimension: { range: ROWS(ES, 44, 44), inheritFromBefore: true } },
        // 02: kolom angka Instagram (Interactions, Comments lebih lebar dari kolom YouTube) — total 1.087 px
        ...[32, 80, 308, 64, 104, 60, 62, 58, 86, 52, 74, 58, 49].map((px, i) => ({
          updateDimensionProperties: { range: { sheetId: sid(PP), dimension: "COLUMNS", startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: "pixelSize" },
        })),
        // 03: Channels (daftar platform) lebih lebar supaya tidak terbungkus 4–5 baris — total 1.087 px
        ...[40, 80, 290, 230, 120, 170, 70, 87].map((px, i) => ({
          updateDimensionProperties: { range: { sheetId: sid(PL), dimension: "COLUMNS", startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: "pixelSize" },
        })),
        // kategori 11 → 9: baris kategori kosong di bawah tabel kiri (r51–r53) dihapus
        { deleteDimension: { range: ROWS(ES, 50, 52) } },
        // baris sisipan tidak ikut merge baris lain: nama/porsi tipe (A:B, D:E) & kategori (H:I, K:L)
        ...[
          [0, 2],
          [3, 5],
          [7, 9],
          [10, 12],
        ].map(([c0, c1]) => ({ mergeCells: { range: { sheetId: sid(ES), startRowIndex: 43, endRowIndex: 44, startColumnIndex: c0, endColumnIndex: c1 }, mergeType: "MERGE_ALL" } })),
      ],
    },
  });
  // rentang pie chart dipasang eksplisit: format = header r41 + 4 baris; kategori = header r41 + 9 kategori + Unpublished
  const r = await c.sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets(properties(sheetId),charts(chartId,spec))" });
  const charts = r.data.sheets!.find((s) => s.properties!.sheetId === sid(ES))!.charts ?? [];
  const requests: Req[] = charts.map((ch) => {
    const spec = structuredClone(ch.spec!);
    const pie = spec.pieChart!;
    const isCategory = (pie.domain!.sourceRange!.sources![0].startColumnIndex ?? 0) >= 6;
    const end = isCategory ? 40 + CATEGORY_SLOTS + 1 : 40 + FORMAT_SLOTS; // index akhir eksklusif (0-based): header r40 = index 39
    for (const src of [pie.domain!.sourceRange!.sources![0], pie.series!.sourceRange!.sources![0]]) {
      src.startRowIndex = 39;
      src.endRowIndex = end;
    }
    spec.title = isCategory ? "Category vs monthly quota" : "Published by format";
    return { updateChartSpec: { chartId: ch.chartId, spec } };
  });
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
}

async function main() {
  const { reportClients, copyFile } = await import("../lib/reports/engine/sheets");
  const { applyRowStyles, assertAnchors, ensureReviewRow, fitWidths } = await import("../lib/reports/engine/template-tools");
  const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const c = await reportClients();
  if (arg("fit-widths")) return fitWidths(c, arg("fit-widths")!);
  if (arg("patch")) {
    await ensureReviewRow(c, arg("patch")!, ES, 50);
    await assertAnchors(c, arg("patch")!, ANCHORS);
    await patchText(c, arg("patch")!);
    await applyRowStyles(c, arg("patch")!, STYLE);
    await fitWidths(c, arg("patch")!);
    return console.log(`Template diperbarui: https://docs.google.com/spreadsheets/d/${arg("patch")}/edit`);
  }
  const from = arg("from");
  if (!from) throw new Error("--from=<ID master template YouTube> (buat template baru) atau --patch=<ID template> wajib");
  const file = await copyFile(c, from, "DRAFT – TEMPLATE – MKK Social Media Monthly Performance Report");
  await restructure(c, file.id);
  await ensureReviewRow(c, file.id, ES, 50);
  await patchText(c, file.id);
  await assertAnchors(c, file.id, ANCHORS);
  await applyRowStyles(c, file.id, STYLE);
  await fitWidths(c, file.id);
  console.log(`Template Social (DRAFT): ${file.url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
