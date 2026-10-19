// Sekali jalan: buat master template laporan News dari laporan contoh user.
// npx tsx scripts/report-template-news.ts --from=<ID file laporan contoh>   → template baru (DRAFT)
// npx tsx scripts/report-template-news.ts --patch=<ID template>          → perbarui teks template yang ada
// npx tsx scripts/report-template-news.ts --fit-widths=<ID template>     → samakan lebar kolom semua sheet (PDF penuh)
// Sumber hanya DISALIN (file user tidak diubah); semua perubahan di file baru milik app.
// Laporan contoh berisi rumus (COUNTIF/XLOOKUP ke Publishing Log & Ref) → semuanya diganti penanda {{…}}.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { ReportClients } from "../lib/reports/engine/sheets";

type Req = Record<string, unknown>;

const ES = "01 Executive Summary";
const AP = "02 Article Performance";
const PL = "03 Publishing Log";
const AR = "04 Articles Under Review";
const MG = "05 Metric Guide";

// Teks laporan untuk client: kalimat pendek & lugas, tanpa jargon (posisi akhir template; dipakai saat build & --patch).
const GUIDE: [string, string, string][] = [
  ["Articles published", "Articles in the Publishing Log with Publish status for the month.", "Measures completed editorial output."],
  ["Articles in review", "Articles submitted and still waiting for approval at the end of the month.", "Shows work that is finished but not yet live."],
  ["Delivered", "Articles published plus articles in review.", "Counts all completed work against the quota."],
  ["Monthly quota", "Planned number of articles for the month.", "Sets the delivery target."],
  ["Quota achievement", "Delivered divided by the monthly quota.", "Shows how much of the target was completed."],
  ["Article views", "Google Analytics views of the articles published this month, counted for {{period}}.", "Main measure of readership."],
  ["Views per article", "Article views divided by the number of published articles.", "Compares readership across months with different output."],
  ["Readers (active users)", "People who viewed a given article.", "Useful per article. One person can read several articles, so the total counts some readers more than once."],
  ["Views / user", "Views divided by active users for the article.", "Shows repeat reading of the same article."],
  ["Avg engagement", "Average time the article was open and in view, per active user.", "Shows depth of attention, not just page opens."],
  ["GA4 match", "Whether the article URL in the Publishing Log was found in Google Analytics.", "Views are only counted for matched URLs."],
  ["Content type and category", "Format (Features, Editorial, Hard News) and topic of each article.", "Shows the balance and breadth of coverage."],
  ["Month-on-month", "KPI cards compare with {{prev_month_label}}.", "Green marks an improvement and red a decline. Articles in review are shown in grey."],
];

const TEXT: Record<string, Record<string, string>> = {
  [ES]: {
    A1: "MAIN KE KUDUS - NEWS MONTHLY PERFORMANCE REPORT - {{month_upper}}",
    A3: "Reporting period: {{period}} · Sources: News Publishing Log and Google Analytics 4",
    A19: "KEY FINDINGS",
    A58: "Views come from Google Analytics for {{period}} and are matched to each article in the Publishing Log by its exact URL. {{match_note}}",
  },
  [AP]: {
    A3: "Published articles and their views, {{period}}",
    A4: "Views from Google Analytics, matched to the Publishing Log by exact URL. Match rate: {{matched}} of {{listed}} articles.",
  },
  // strip angka = definisi dashboard: achievement = delivered (published + in review) ÷ kuota, sisa = kuota − delivered
  [PL]: {
    A1: "PUBLISHING LOG · {{month_upper}}",
    A3: "Articles published in {{month_label}}",
    A5: "PUBLISHED",
    C5: "MONTHLY QUOTA",
    E5: "QUOTA ACHIEVEMENT",
    G5: "REMAINING QUOTA",
    A6: "{{published}}",
    C6: "{{quota}}",
    E6: "{{achievement}}",
    G6: "{{remaining}}",
  },
  [AR]: { A1: "ARTICLES UNDER REVIEW · {{month_upper}}", A3: "Articles submitted and waiting for approval at the end of {{month_label}}" },
  [MG]: {
    A3: "How the figures in this report are defined",
    ...Object.fromEntries(GUIDE.flatMap(([a, b, c], i) => [[`A${6 + i}`, a], [`B${6 + i}`, b], [`C${6 + i}`, c]])),
    A21: "REPORTING METHODOLOGY",
    A22: "Articles come from the monthly Publishing Log. Views come from Google Analytics for {{period}}, matched by exact URL. Figures are final once the month is closed.",
  },
};

async function patchText(c: ReportClients, id: string) {
  const data = Object.entries(TEXT).flatMap(([sheet, cells]) => Object.entries(cells).map(([a1, v]) => ({ range: `'${sheet.replace(/'/g, "''")}'!${a1}`, values: [[v]] })));
  await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data } });
  // menulis teks ke sel mereset format angkanya → format strip 03 (A6:H6) dipasang lagi
  const meta = await c.sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets(properties(sheetId,title))" });
  const pl = meta.data.sheets!.find((x) => x.properties!.title === PL)!.properties!.sheetId!;
  const num = (c0: number, c1: number, type: string, pattern: string) => ({
    repeatCell: { range: { sheetId: pl, startRowIndex: 5, endRowIndex: 6, startColumnIndex: c0, endColumnIndex: c1 }, cell: { userEnteredFormat: { numberFormat: { type, pattern } } }, fields: "userEnteredFormat.numberFormat" },
  });
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: [num(0, 4, "NUMBER", "#,##0"), num(4, 6, "PERCENT", "0.0%"), num(6, 9, "NUMBER", "#,##0")] } });
}

async function main() {
  const { reportClients, copyFile, readGrids } = await import("../lib/reports/engine/sheets");
  const { fitWidths } = await import("../lib/reports/engine/template-tools");
  const { NEWS_CATEGORY_SLOTS } = await import("../lib/reports/channels/news");
  const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const c = await reportClients();
  if (arg("fit-widths")) return fitWidths(c, arg("fit-widths")!);
  if (arg("patch")) {
    await patchText(c, arg("patch")!);
    await fitWidths(c, arg("patch")!);
    return console.log(`Teks template diperbarui: https://docs.google.com/spreadsheets/d/${arg("patch")}/edit`);
  }
  const from = arg("from");
  if (!from) throw new Error("--from=<ID laporan contoh> (buat template baru) atau --patch=<ID template> (perbarui teks) wajib");

  const file = await copyFile(c, from, "DRAFT – TEMPLATE – MKK News Monthly Performance Report");
  const id = file.id;
  const grids = await readGrids(c, id);
  const sid = (title: string) => grids.find((g) => g.title === title)!.sheetId;
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const batch = async (requests: Req[]) => requests.length && (await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } }));
  const write = async (values: { range: string; values: (string | number)[][] }[]) =>
    values.length && (await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data: values } }));

  const range = (sheet: string, r1: number, c0: number, c1 = c0 + 1, r2 = r1) => ({ sheetId: sid(sheet), startRowIndex: r1 - 1, endRowIndex: r2, startColumnIndex: c0, endColumnIndex: c1 });
  const del = (sheet: string, from1: number, to1: number): Req => ({ deleteDimension: { range: { sheetId: sid(sheet), dimension: "ROWS", startIndex: from1 - 1, endIndex: to1 } } });
  const insert = (sheet: string, at1: number, count: number): Req[] => [
    // sisip `count` baris sebelum baris at1, format & merge-nya ikut baris di atasnya
    { insertDimension: { range: { sheetId: sid(sheet), dimension: "ROWS", startIndex: at1 - 1, endIndex: at1 - 1 + count }, inheritFromBefore: true } },
    {
      copyPaste: {
        source: { sheetId: sid(sheet), startRowIndex: at1 - 2, endRowIndex: at1 - 1 },
        destination: { sheetId: sid(sheet), startRowIndex: at1 - 1, endRowIndex: at1 - 1 + count },
        pasteType: "PASTE_FORMAT",
      },
    },
  ];
  const rowPx = (sheet: string, from1: number, to1: number, px: number): Req => ({
    updateDimensionProperties: { range: { sheetId: sid(sheet), dimension: "ROWS", startIndex: from1 - 1, endIndex: to1 }, properties: { pixelSize: px }, fields: "pixelSize" },
  });
  const colPx = (sheet: string, widths: number[]): Req[] =>
    widths.map((px, col) => ({ updateDimensionProperties: { range: { sheetId: sid(sheet), dimension: "COLUMNS", startIndex: col, endIndex: col + 1 }, properties: { pixelSize: px }, fields: "pixelSize" } }));
  const merge = (sheet: string, r1: number, c0: number, c1: number): Req => ({ mergeCells: { range: range(sheet, r1, c0, c1), mergeType: "MERGE_ALL" } });
  // format angka dikirim SETELAH penanda ditulis: menulis teks ke sel mereset format angkanya
  const fmt = (sheet: string, r1: number, c0: number, c1: number, pattern: string, type = "NUMBER", align?: "RIGHT", r2 = r1): Req => ({
    repeatCell: {
      range: range(sheet, r1, c0, c1, r2),
      cell: { userEnteredFormat: { numberFormat: { type, pattern }, ...(align ? { horizontalAlignment: align } : {}) } },
      fields: align ? "userEnteredFormat(numberFormat,horizontalAlignment)" : "userEnteredFormat.numberFormat",
    },
  });
  const right = (sheet: string, r1: number, c0: number, c1: number): Req => ({
    repeatCell: { range: range(sheet, r1, c0, c1), cell: { userEnteredFormat: { horizontalAlignment: "RIGHT" } }, fields: "userEnteredFormat.horizontalAlignment" },
  });
  const tidy = (sheet: string, frozen: number): Req => ({
    updateSheetProperties: { properties: { sheetId: sid(sheet), gridProperties: { hideGridlines: true, frozenRowCount: frozen } }, fields: "gridProperties(hideGridlines,frozenRowCount)" },
  });
  const put = (sheet: string, a1: string, row: (string | number)[]) => ({ range: `${q(sheet)}!${a1}`, values: [row] });
  const DATE = ["DATE", "dd mmm yyyy"] as const;

  // ── 02 Article Performance: header r6, artikel r7–r48 → contoh r7, baris TOTAL r8. Kolom URL (K) dihapus: URL
  // panjang membuat tiap baris 3–4 baris teks, dan URL sudah ada di 03 Publishing Log
  const tableRow = (t: string, cols: string[]) => cols.map((k) => `{{#${t}.${k}}}`);
  // Baris kosong berformat (border, dropdown) sisa file asli ikut dihapus — kalau tidak, PDF mencetak halaman kosong.
  await batch([
    del(AP, 50, 60),
    del(AP, 8, 48),
    { deleteDimension: { range: { sheetId: sid(AP), dimension: "COLUMNS", startIndex: 10, endIndex: 11 } } },
    del(PL, 11, 200),
    del(AR, 11, 200),
  ]);
  // ── 05 Metric Guide: 10 baris isi (r6–r15) → 13 baris; metodologi (r22) dilebarkan ke A:G; 03/04: tabel → contoh r10
  await batch([
    ...insert(MG, 16, 3),
    rowPx(MG, 6, 18, 36),
    { unmergeCells: { range: range(MG, 22, 0, 7) } },
    merge(MG, 22, 0, 7),
    { repeatCell: { range: range(MG, 22, 0, 7), cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } }, fields: "userEnteredFormat(wrapStrategy,verticalAlignment)" } },
    rowPx(MG, 22, 22, 40),
    ...colPx(MG, [200, 430, 425, 8, 8, 8, 8]),
  ]);
  // ── 01 Executive Summary, tahap 1: kategori 13 → NEWS_CATEGORY_SLOTS baris (disisipkan DI DALAM rentang pie chart
  // supaya rentangnya ikut melebar); temuan r16 dilebarkan A:L
  const extraCats = NEWS_CATEGORY_SLOTS - 13;
  await batch([
    ...insert(ES, 50, extraCats),
    ...Array.from({ length: extraCats }, (_, i) => [merge(ES, 50 + i, 7, 9), merge(ES, 50 + i, 10, 12)]).flat(),
    { unmergeCells: { range: range(ES, 16, 0, 12) } },
    merge(ES, 16, 0, 12),
  ]);

  // nilai (koordinat setelah tahap di atas)
  const catRows = Array.from({ length: NEWS_CATEGORY_SLOTS }, (_, i) => put(ES, `H${38 + i}`, [`{{cat.${i + 1}.name}}`, "", `{{cat.${i + 1}.count}}`, `{{cat.${i + 1}.share}}`]));
  const afterCats = 38 + NEWS_CATEGORY_SLOTS; // baris "Under review"
  await write([
    put(AP, "A7", tableRow("articles", ["no", "date", "title", "type", "category", "views", "users", "views_per_user", "avg_time", "match"])),
    put(AP, "A8", ["", "", "TOTAL ({{listed}} articles)", "", "", "{{articles.total_views}}", "{{articles.total_users}}", "{{articles.total_vpu}}", "{{articles.total_avg_time}}", "{{matched}} / {{listed}}"]),
    put(PL, "A10", tableRow("log", ["no", "date", "title", "url", "reporter", "category", "type", "status", "method"])),
    put(AR, "A5", ["ARTICLES IN REVIEW", "", "MONTHLY QUOTA", "", "SHARE OF QUOTA", "", "PUBLISHED"]),
    put(AR, "A6", ["{{in_review}}", "", "{{quota}}", "", "{{review_share}}", "", "{{published}}"]),
    put(AR, "A10", tableRow("review", ["no", "date", "title", "submitted", "reporter", "category", "type", "status", "method"])),
    put("Ref", "I2", ["{{period}}", "{{month_name}}", "{{year}}"]),
    put("Ref", "I3", ["{{quota}}"]),
    put(ES, "A10", ["{{top.title}}"]),
    put(ES, "I11", ["{{top.views}}", "", "{{top.avg_time}}"]),
    put(ES, "A16", ["{{#findings.text}}"]),
    // PDF: Content Breakdown (chart + tabel) selalu mulai di halaman 2
    put(ES, "L22", ["{{pagebreak}}"]),
    ...[1, 2, 3].map((i) => put(ES, `A${37 + i}`, [`{{type.${i}.name}}`, "", `{{type.${i}.count}}`, `{{type.${i}.share}}`])),
    put(ES, "A41", ["Published Total", "", "{{types.total}}", 1]),
    ...catRows,
    put(ES, `H${afterCats}`, ["Under review", "", "{{cat.review}}", "{{cat.review_share}}"]),
    put(ES, `H${afterCats + 1}`, ["Unpublished", "", "{{cat.unpublished}}", "{{cat.unpublished_share}}"]),
    put(ES, `H${afterCats + 2}`, ["Monthly Quota", "", "{{cat.quota}}", 1]),
  ]);

  const bold = (sheet: string, r1: number, c0: number, c1: number): Req => ({
    repeatCell: {
      range: range(sheet, r1, c0, c1),
      cell: { userEnteredFormat: { textFormat: { bold: true }, borders: { top: { style: "SOLID", color: { red: 0.13, green: 0.14, blue: 0.16 } } } } },
      fields: "userEnteredFormat(textFormat.bold,borders.top)",
    },
  });
  await batch([
    // 02: angka rata kanan (header ikut), tanggal, waktu dalam detik; TOTAL = format baris contoh + tebal
    fmt(AP, 7, 1, 2, DATE[1], DATE[0]),
    fmt(AP, 7, 5, 7, "#,##0", "NUMBER", "RIGHT"),
    fmt(AP, 7, 7, 8, "0.00", "NUMBER", "RIGHT"),
    fmt(AP, 7, 8, 9, '0" sec"', "NUMBER", "RIGHT"),
    right(AP, 6, 5, 9),
    { copyPaste: { source: range(AP, 7, 0, 10), destination: range(AP, 8, 0, 10), pasteType: "PASTE_FORMAT" } },
    bold(AP, 8, 0, 10),
    rowPx(AP, 7, 8, 30),
    ...colPx(AP, [34, 86, 420, 80, 100, 56, 66, 66, 85, 94]),
    tidy(AP, 6),
    // 03 / 04: strip angka & tanggal
    fmt(PL, 10, 1, 2, DATE[1], DATE[0]),
    { setDataValidation: { range: range(PL, 10, 0, 9) } }, // dropdown status/tipe input log tidak relevan di laporan
    tidy(PL, 9),
    fmt(AR, 6, 0, 4, "#,##0"),
    fmt(AR, 6, 4, 6, "0.0%", "PERCENT"),
    fmt(AR, 6, 6, 9, "#,##0"),
    fmt(AR, 10, 1, 2, DATE[1], DATE[0]),
    // kolom D dulu URL (gaya tautan, lebar) → sekarang tanggal: format disalin dari kolom B, headline dilebarkan
    { copyPaste: { source: range(AR, 10, 1, 2), destination: range(AR, 10, 3, 4), pasteType: "PASTE_FORMAT" } },
    { setDataValidation: { range: range(AR, 10, 0, 9) } },
    ...colPx(AR, [41, 86, 440, 100, 112, 100, 82, 66, 60]),
    tidy(AR, 0),
    tidy(MG, 0),
    // Executive Summary: tabel tipe & kategori, top article
    fmt(ES, 38, 2, 3, "#,##0", "NUMBER", "RIGHT", 41),
    fmt(ES, 38, 3, 5, "0.0%", "PERCENT", undefined, 41),
    fmt(ES, 38, 9, 10, "#,##0", "NUMBER", "RIGHT", afterCats + 2),
    fmt(ES, 38, 10, 12, "0.0%", "PERCENT", undefined, afterCats + 2),
    right(ES, 37, 2, 3),
    right(ES, 37, 9, 10),
    fmt(ES, 11, 8, 10, "#,##0"),
    {
      repeatCell: {
        range: range(ES, 16, 0, 12),
        cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
      },
    },
    rowPx(ES, 16, 16, 24),
    rowPx(ES, 38, afterCats + 2, 19),
    { updateSheetProperties: { properties: { sheetId: sid("Ref"), hidden: true }, fields: "hidden" } },
  ]);

  // ── Executive Summary, tahap 2 (bawah → atas): baris kosong r23 di atas chart dihapus supaya Content Breakdown muat
  // 1 halaman PDF; temuan contoh r16, r17–r19 dihapus; strip KPI lama (r4–r7) diganti blok kartu
  await batch([del(ES, 23, 23), del(ES, 17, 19), del(ES, 4, 7)]);
  // kartu: 4 per baris (kolom A:C, D:F, G:I, J:L), 2 baris → sisip 8 baris di r4:
  // r4 spasi, r5–r7 kartu baris 1 (label, nilai, perubahan), r8 spasi, r9–r11 kartu baris 2
  const KPIS = ["published", "in_review", "delivered", "achievement", "views", "views_per_article", "readers", "avg_engagement_time"];
  const COLS: [number, number][] = [[0, 3], [3, 6], [6, 9], [9, 12]];
  const FMT: Record<string, [string, string]> = { achievement: ["PERCENT", "0.0%"], views_per_article: ["NUMBER", "0.0"] };
  const white = { red: 1, green: 1, blue: 1 };
  const border = { style: "SOLID", color: { red: 0.85, green: 0.86, blue: 0.88 } };
  const cardReqs: Req[] = [{ insertDimension: { range: { sheetId: sid(ES), dimension: "ROWS", startIndex: 3, endIndex: 11 }, inheritFromBefore: false } }];
  const cardVals: { range: string; values: string[][] }[] = [];
  const cardFormats: Req[] = [];
  KPIS.forEach((k, i) => {
    const top = 5 + Math.floor(i / 4) * 4; // 1-based: r5, r9
    const [c0, c1] = COLS[i % 4];
    for (let r = 0; r < 3; r++) cardReqs.push(merge(ES, top + r, c0, c1));
    cardReqs.push({ updateBorders: { range: range(ES, top, c0, c1, top + 2), top: border, bottom: border, left: border, right: border } });
    cardReqs.push({
      repeatCell: { range: range(ES, top, c0, c1), cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontSize: 9, foregroundColor: { red: 0.37, green: 0.39, blue: 0.41 } }, padding: { left: 8 } } }, fields: "userEnteredFormat(backgroundColor,textFormat,padding)" },
    });
    cardReqs.push({
      repeatCell: { range: range(ES, top + 1, c0, c1), cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontSize: 18, bold: true }, horizontalAlignment: "LEFT", padding: { left: 8 } } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)" },
    });
    cardReqs.push({ repeatCell: { range: range(ES, top + 2, c0, c1), cell: { userEnteredFormat: { textFormat: { fontSize: 9 }, padding: { left: 8 } } }, fields: "userEnteredFormat(textFormat,padding)" } });
    const [type, pattern] = FMT[k] ?? ["NUMBER", "#,##0"];
    cardFormats.push({ repeatCell: { range: range(ES, top + 1, c0, c1), cell: { userEnteredFormat: { numberFormat: { type, pattern } } }, fields: "userEnteredFormat.numberFormat" } });
    const a = (r: number) => `${q(ES)}!${String.fromCharCode(65 + c0)}${r}`;
    cardVals.push({ range: a(top), values: [[`{{kpi.${k}.label}}`]] }, { range: a(top + 1), values: [[`{{kpi.${k}.value}}`]] }, { range: a(top + 2), values: [[`{{kpi.${k}.change}}`]] });
  });
  cardReqs.push(rowPx(ES, 4, 4, 12), rowPx(ES, 8, 8, 12), rowPx(ES, 6, 6, 34), rowPx(ES, 10, 10, 34), tidy(ES, 0));
  await batch(cardReqs);
  await write(cardVals);
  await batch(cardFormats);

  // judul pie chart (dulu keduanya "Category")
  const charts = (await c.sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets(properties(title),charts(chartId,spec))" })).data.sheets!.find((s) => s.properties!.title === ES)!.charts ?? [];
  await batch(
    charts.map((ch) => {
      const domainCol = ch.spec!.pieChart?.domain?.sourceRange?.sources?.[0]?.startColumnIndex;
      return { updateChartSpec: { chartId: ch.chartId, spec: { ...ch.spec, title: domainCol === 0 ? "Published by content type" : "Category vs monthly quota" } } };
    }),
  );

  await patchText(c, id);
  await fitWidths(c, id);
  console.log(`Template dibuat: ${file.url}`);
  console.log(`Setelah disetujui, isi di .env.local: REPORT_TEMPLATE_NEWS=${id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
