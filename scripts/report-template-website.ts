// Sekali jalan: buat master template laporan Website dari laporan September user.
// npx tsx scripts/report-template-website.ts --from=<ID file laporan contoh>   → template baru
// npx tsx scripts/report-template-website.ts --patch=<ID template>          → perbarui teks template yang ada
// npx tsx scripts/report-template-website.ts --fit-widths=<ID template>     → samakan lebar kolom semua sheet (PDF penuh)
// Sumber hanya DISALIN (file user tidak diubah); semua perubahan di file baru milik app.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { RowStyleSpec } from "../lib/reports/engine/template-tools";

type Req = Record<string, unknown>;

// Teks laporan untuk client: kalimat pendek & lugas, tanpa jargon teknis (dipakai saat build & --patch).
const TEXT: Record<string, Record<string, string>> = {
  "01 Executive Summary": {
    A1: "MAIN KE KUDUS | WEBSITE MONTHLY PERFORMANCE REPORT - {{month_label}}",
    A2: "Reporting period: {{period}} · Sources: Google Analytics 4 and Google Search Console",
    H21: "Share of Users",
    A24: "KEY FINDINGS",
    A27: "NOTES",
    A28: "Figures cover {{period}}. City figures in Google Analytics are estimates, and visits from outside Indonesia are not included in the city ranking.",
  },
  "02 Traffic Acquisition": { A2: "Sessions by channel, {{period}}", F4: "Avg Engagement Time" },
  "03 Visitor Cities": {
    A2: "Top 10 cities in Indonesia by active users, {{period}}",
    D4: "Share of All Users",
    E4: "Share of Top 10",
    F4: "Last Month",
    G4: "Change",
    F5: "{{#cities.prev_users}}",
    G5: "{{#cities.change}}",
    B6: "TOP 10 TOTAL",
    F6: "{{cities.prev_shown_users}}",
    G6: "{{cities.shown_change}}",
    A8: "ALL USERS",
    F8: "{{cities.prev_site_users}}",
    G8: "{{cities.site_change}}",
    A9: "OTHER LOCATIONS",
    F9: "{{cities.prev_gap_users}}",
    G9: "{{cities.gap_change}}",
  },
  "04 Page Performance": { A2: "Top 10 of {{pages.count}} pages by views, {{period}}", A5: "TOTAL (all {{pages.count}} pages)", E4: "Avg Engagement Time" },
  "05 Landing Pages": {
    A2: "Top 10 of {{landing.count}} landing pages by sessions, {{period}}. Sessions without a recorded landing page are not listed.",
    E4: "Avg Engagement Time",
  },
  "06 Search Console": { A2: "Google web search results for mainkekudus.com, {{period}}" },
  "07 Search Queries": { A2: "Top 10 search queries by clicks, {{period}}. Google does not report rare queries, so rows do not add up to the totals." },
  "08 Search Pages": { A2: "Top 10 pages in Google Search by clicks, {{period}}" },
  "09 GSC Devices & Countries": { A2: "Google Search clicks by device and country, {{period}}", E4: "", E5: "", E9: "", E10: "" },
  "10 Metric Guide & Sources": {
    A1: "METRIC GUIDE & SOURCES",
    A2: "How the figures in this report are defined",
    ...Object.fromEntries(
      (
        [
          ["Source", "Google Analytics 4", "Main Ke Kudus website property, full calendar month."],
          ["Source", "Google Search Console", "Google web search results for mainkekudus.com. Totals may differ from the sum of the rows."],
          ["Comparison", "Month-on-month", "KPI cards compare with {{prev_month_label}}. Green marks an improvement and red a decline; a lower bounce rate or position counts as an improvement."],
          ["Coverage", "Pages", "Totals include all {{pages.count}} pages. The table shows the 10 most viewed."],
          ["Coverage", "Landing pages", "Totals include all {{landing.count}} landing pages. The table shows the 10 with the most sessions, excluding sessions without a recorded landing page."],
          ["Coverage", "Cities", "Top 10 cities in Indonesia. Visits from abroad, mostly automated traffic from data centres, and users without an identified city are not ranked."],
          ["Coverage", "Search queries and pages", "Top 10 queries and top 10 pages by clicks. Google does not report rare queries, so rows do not add up to the totals."],
          ["Definition", "Users", "People who visited the site during the month."],
          ["Definition", "Sessions", "Visits to the site. One person can make several visits."],
          ["Definition", "Views", "Pages viewed, including repeat views."],
          ["Definition", "Engagement rate", "Share of visits that lasted longer than 10 seconds, viewed two or more pages, or included a key event."],
          ["Definition", "Bounce rate", "Share of visits that were not engaged (100% minus the engagement rate)."],
          ["Definition", "Avg engagement time", "Average time the site was open and in view, per visit."],
          ["Definition", "Search clicks vs sessions", "Google Search clicks and Organic Search sessions are measured differently and will not match exactly."],
          ["Definition", "CTR and position", "CTR is clicks divided by impressions. Position is the average ranking in Google results; lower is better."],
          ["Data", "Final figures", "Figures are final. The month is closed after the last data refresh."],
        ] as const
      ).flatMap(([a, b, c], i) => [
        [`A${6 + i}`, a],
        [`B${6 + i}`, b],
        [`C${6 + i}`, c],
      ]),
    ),
  },
};

/** Peran baris tiap sheet (posisi template) → tinggi & ukuran huruf standar semua laporan (ROW_STYLE). */
const titled = (...rest: RowStyleSpec[string]): RowStyleSpec[string] => [["sheetTitle", 1], ["subtitle", 2], ...rest];
const STYLE: RowStyleSpec = {
  "01 Executive Summary": [
    ["reportTitle", 1],
    ["subtitle", 2],
    ["autoFit", [3, 4]],
    ...[5, 10, 15].flatMap((r): RowStyleSpec[string] => [["cardLabel", r], ["cardValue", r + 1], ["cardLabel", r + 2]]),
    ["section", 20],
    ["header", 21],
    ["row", 22],
    ["section", 24],
    ["text", 25],
    ["section", 27],
    ["note", 28],
  ],
  "02 Traffic Acquisition": titled(["header", 4], ["total", 5], ["row", 6]),
  "03 Visitor Cities": titled(["header", 4], ["row", 5], ["total", 6], ["row", [8, 9]]),
  "04 Page Performance": titled(["header", 4], ["total", 5], ["row", 6]),
  "05 Landing Pages": titled(["header", 4], ["total", 5], ["row", 6]),
  "06 Search Console": titled(["cardLabel", 4], ["cardValue", 5], ["section", 7], ["header", 9], ["row", 10]),
  "07 Search Queries": titled(["header", 4], ["row", 5]),
  "08 Search Pages": titled(["header", 4], ["row", 5]),
  "09 GSC Devices & Countries": titled(["header", 4], ["row", 5], ["section", 7], ["header", 9], ["row", 10]),
  "10 Metric Guide & Sources": titled(["header", 4], ["text", [5, 21]]),
};

/** Teks penanda di posisi yang dipakai TEXT & STYLE; layout berubah (template diedit) → patch berhenti. */
const ANCHORS: Record<string, string> = {
  "'01 Executive Summary'!A20": "ACQUISITION MIX",
  "'01 Executive Summary'!A24": "KEY FINDINGS",
  "'01 Executive Summary'!A27": "NOTES",
  "'02 Traffic Acquisition'!A5": "TOTAL",
  "'03 Visitor Cities'!A4": "Rank",
  "'06 Search Console'!A7": "DAILY SEARCH PERFORMANCE",
  "'09 GSC Devices & Countries'!A7": "COUNTRY BREAKDOWN",
  "'10 Metric Guide & Sources'!A4": "Section",
};

/** Tulis TEXT + format kolom baru sheet 03 ke template yang sudah ada (desain/edit user lain tidak disentuh). */
async function patchText(c: Awaited<ReturnType<typeof import("../lib/reports/engine/sheets").reportClients>>, id: string) {
  const data = Object.entries(TEXT).flatMap(([sheet, cells]) => Object.entries(cells).map(([a1, v]) => ({ range: `'${sheet.replace(/'/g, "''")}'!${a1}`, values: [[v]] })));
  await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data } });
  const meta = await c.sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets(properties(sheetId,title))" });
  const vc = meta.data.sheets!.find((x) => x.properties!.title === "03 Visitor Cities")!.properties!.sheetId!;
  const cell = (r1: number, c0: number, format: Record<string, unknown>, fields: string) => ({
    repeatCell: { range: { sheetId: vc, startRowIndex: r1 - 1, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c0 + 1 }, cell: { userEnteredFormat: format }, fields },
  });
  const requests: Req[] = [cell(4, 5, { horizontalAlignment: "RIGHT" }, "userEnteredFormat.horizontalAlignment"), cell(4, 6, { horizontalAlignment: "RIGHT" }, "userEnteredFormat.horizontalAlignment")];
  for (const r of [5, 6, 8, 9]) {
    requests.push(cell(r, 5, { numberFormat: { type: "NUMBER", pattern: "#,##0" }, horizontalAlignment: "RIGHT" }, "userEnteredFormat(numberFormat,horizontalAlignment)"));
    requests.push(cell(r, 6, { numberFormat: { type: "PERCENT", pattern: "+0.0%;-0.0%;0.0%" }, horizontalAlignment: "RIGHT" }, "userEnteredFormat(numberFormat,horizontalAlignment)"));
  }
  // tinggi baris diatur ROW_STYLE (STYLE di bawah); baris spasi r7 dirapatkan
  requests.push({ updateDimensionProperties: { range: { sheetId: vc, dimension: "ROWS", startIndex: 6, endIndex: 7 }, properties: { pixelSize: 12 }, fields: "pixelSize" } });
  // bagian SUMMARY (r10 spasi, r11 judul, r12 kalimat) dihapus — isinya sudah ada di Key Findings; idempoten
  const vcRows = (await c.sheets.spreadsheets.values.get({ spreadsheetId: id, range: "'03 Visitor Cities'!A11" })).data.values?.[0]?.[0];
  if (vcRows === "SUMMARY" || vcRows === "GEOGRAPHIC READOUT")
    requests.push({ deleteDimension: { range: { sheetId: vc, dimension: "ROWS", startIndex: 9, endIndex: 12 } } });
  // kolom F–G dulu berisi kalimat panjang; sekarang angka → lebar disesuaikan
  for (const col of [5, 6]) requests.push({ updateDimensionProperties: { range: { sheetId: vc, dimension: "COLUMNS", startIndex: col, endIndex: col + 1 }, properties: { pixelSize: 120 }, fields: "pixelSize" } });
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
}

async function main() {
  const fit = process.argv.find((a) => a.startsWith("--fit-widths="))?.split("=")[1];
  if (fit) {
    const { reportClients } = await import("../lib/reports/engine/sheets");
    const { fitWidths } = await import("../lib/reports/engine/template-tools");
    await fitWidths(await reportClients(), fit);
    return;
  }
  const patch = process.argv.find((a) => a.startsWith("--patch="))?.split("=")[1];
  if (patch) {
    const { reportClients } = await import("../lib/reports/engine/sheets");
    const { applyRowStyles, assertAnchors, fitWidths } = await import("../lib/reports/engine/template-tools");
    const c = await reportClients();
    await assertAnchors(c, patch, ANCHORS);
    await patchText(c, patch);
    await applyRowStyles(c, patch, STYLE);
    await fitWidths(c, patch);
    console.log(`Teks template diperbarui: https://docs.google.com/spreadsheets/d/${patch}/edit`);
    return;
  }
  const from = process.argv.find((a) => a.startsWith("--from="))?.split("=")[1];
  if (!from) throw new Error("--from=<ID laporan contoh> (buat template baru) atau --patch=<ID template> (perbarui teks) wajib");
  const { reportClients, copyFile, readGrids } = await import("../lib/reports/engine/sheets");
  const { fitWidths } = await import("../lib/reports/engine/template-tools");
  const c = await reportClients();
  const file = await copyFile(c, from, "TEMPLATE – MKK Website Monthly Performance Report");
  const id = file.id;
  const grids = await readGrids(c, id);
  const sid = (title: string) => grids.find((g) => g.title === title)!.sheetId;
  // baris terakhir yang berisi (1-based); grid API mengembalikan baris kosong sampai akhir sheet
  const lastRow = (title: string) => {
    const rows = grids.find((g) => g.title === title)!.rows;
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].some((v) => v)) return i + 1;
    return 1;
  };

  const requests: Req[] = [];
  const values: { range: string; values: (string | number)[][] }[] = [];
  const put = (sheet: string, a1: string, row: (string | number)[]) => values.push({ range: `'${sheet.replace(/'/g, "''")}'!${a1}`, values: [row] });
  // hapus baris (1-based inklusif) — diproses dari bawah ke atas per sheet
  const del = (sheet: string, from1: number, to1: number) =>
    requests.push({ deleteDimension: { range: { sheetId: sid(sheet), dimension: "ROWS", startIndex: from1 - 1, endIndex: to1 } } });
  // format angka dikirim SETELAH penanda ditulis: menulis teks ke sel mereset format angkanya
  const formats: Req[] = [];
  const numFmt = (sheet: string, r1: number, c0: number, c1: number, pattern: string, type = "NUMBER") =>
    formats.push({
      repeatCell: {
        range: { sheetId: sid(sheet), startRowIndex: r1 - 1, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 },
        cell: { userEnteredFormat: { numberFormat: { type, pattern }, horizontalAlignment: "RIGHT" } },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    });
  // header di atas kolom angka ikut rata kanan (kolom angka diberi rata kanan oleh numFmt)
  const headerRight = (sheet: string, r1: number, c0: number, c1: number) =>
    formats.push({
      repeatCell: {
        range: { sheetId: sid(sheet), startRowIndex: r1 - 1, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 },
        cell: { userEnteredFormat: { horizontalAlignment: "RIGHT" } },
        fields: "userEnteredFormat.horizontalAlignment",
      },
    });
  const tidy = (sheet: string, frozen: number) =>
    requests.push({ updateSheetProperties: { properties: { sheetId: sid(sheet), gridProperties: { hideGridlines: true, frozenRowCount: frozen } }, fields: "gridProperties(hideGridlines,frozenRowCount)" } });

  // ── 02 Traffic Acquisition: header r4, total r5, data r6–12 → satu baris contoh r6
  const TA = "02 Traffic Acquisition";
  del(TA, 7, 12);
  put(TA, "A2", ["GA4 · {{period}} · all channel groups"]);
  put(TA, "A5", ["TOTAL", "{{total.sessions}}", 1, "{{total.engaged}}", "{{total.er}}", "{{total.avg_time}}", "{{total.events}}", "{{total.events_per_session}}"]);
  put(TA, "A6", ["{{#channels.name}}", "{{#channels.sessions}}", "{{#channels.share}}", "{{#channels.engaged}}", "{{#channels.er}}", "{{#channels.avg_time}}", "{{#channels.events}}", "{{#channels.events_per_session}}"]);
  for (const r of [5, 6]) {
    numFmt(TA, r, 1, 2, "#,##0");
    numFmt(TA, r, 2, 3, "0.0%", "PERCENT");
    numFmt(TA, r, 3, 4, "#,##0");
    numFmt(TA, r, 4, 5, "0.0%", "PERCENT");
    numFmt(TA, r, 5, 6, '0" sec"');
    numFmt(TA, r, 6, 7, "#,##0");
    numFmt(TA, r, 7, 8, "0.00");
  }
  headerRight(TA, 4, 1, 8);
  tidy(TA, 4);

  // ── 03 Visitor Cities: data r5–11 → contoh r5; total r12; site r14; gap r15; readout r18–21 → contoh r18
  const VC = "03 Visitor Cities";
  del(VC, 19, 21);
  del(VC, 6, 11);
  put(VC, "A2", ["GA4 · Active users by city · {{period}} · top 10 Indonesian cities (locations abroad & unidentified cities excluded)"]);
  put(VC, "A4", ["Rank", "City", "Active Users", "Share of Site Active Users", "Share of Cities Shown", "Audience Readout", "Data Quality Note"]);
  put(VC, "A5", ["{{#cities.rank}}", "{{#cities.city}}", "{{#cities.users}}", "{{#cities.share_site}}", "{{#cities.share_shown}}", "{{#cities.readout}}", "{{#cities.note}}"]);
  put(VC, "A6", ["", "CITIES SHOWN", "{{cities.shown_users}}", "{{cities.shown_share}}", 1, "Sum of the city rows shown.", "Not an exhaustive city list."]);
  put(VC, "A8", ["SITE-WIDE ACTIVE USERS", "", "{{pages.total_users}}", 1, "", "GA4 site-wide active users."]);
  put(VC, "A9", ["GAP VS CITIES SHOWN", "", "{{cities.gap_users}}", "{{cities.gap_share}}", "", "Users in smaller Indonesian cities, abroad (mostly crawler/data-centre traffic) or without an identified city."]);
  for (const r of [5, 6, 8, 9]) {
    numFmt(VC, r, 2, 3, "#,##0");
    numFmt(VC, r, 3, 5, "0.0%", "PERCENT");
  }
  headerRight(VC, 4, 2, 5);
  tidy(VC, 4);

  // ── 04 Page Performance: total r5, data r6–15 → contoh r6
  const PP = "04 Page Performance";
  del(PP, 7, 15);
  put(PP, "A2", ["GA4 · total plus top 10 of {{pages.count}} page paths · {{period}}"]);
  put(PP, "A5", ["TOTAL (all {{pages.count}} paths)", "{{pages.total_views}}", "{{pages.total_users}}", "{{pages.total_vpu}}", "{{pages.total_avg_time}}", "{{pages.total_events}}"]);
  put(PP, "A6", ["{{#pages.path}}", "{{#pages.views}}", "{{#pages.users}}", "{{#pages.views_per_user}}", "{{#pages.avg_time}}", "{{#pages.events}}"]);
  for (const r of [5, 6]) {
    numFmt(PP, r, 1, 3, "#,##0");
    numFmt(PP, r, 3, 4, "0.00");
    numFmt(PP, r, 4, 5, '0" sec"');
    numFmt(PP, r, 5, 6, "#,##0");
  }
  headerRight(PP, 4, 1, 6);
  tidy(PP, 4);

  // ── 05 Landing Pages: total r5, data r6–15 → contoh r6
  const LP = "05 Landing Pages";
  del(LP, 7, 15);
  put(LP, "A2", ["GA4 · total plus top 10 of {{landing.count}} landing pages (excluding “(not set)”) · {{period}}"]);
  put(LP, "A5", ["TOTAL (all {{landing.count}} landing pages)", "{{landing.total_sessions}}", "{{landing.total_users}}", "{{landing.total_new_users}}", "{{landing.total_avg_time}}"]);
  put(LP, "A6", ["{{#landing.path}}", "{{#landing.sessions}}", "{{#landing.users}}", "{{#landing.new_users}}", "{{#landing.avg_time}}"]);
  for (const r of [5, 6]) {
    numFmt(LP, r, 1, 4, "#,##0");
    numFmt(LP, r, 4, 5, '0" sec"');
  }
  headerRight(LP, 4, 1, 5);
  tidy(LP, 4);

  // ── 06 Search Console: total r5; harian r10–39 → contoh r10
  const SC = "06 Search Console";
  del(SC, 11, 39);
  put(SC, "A2", ["Google Search Console · Web search · {{period}} · separate from GA4 sessions and users"]);
  put(SC, "A5", ["{{gsc.clicks}}", "{{gsc.impressions}}", "{{gsc.ctr}}", "{{gsc.position}}"]);
  put(SC, "A10", ["{{#gsc_daily.date}}", "{{#gsc_daily.clicks}}", "{{#gsc_daily.impressions}}", "{{#gsc_daily.ctr}}", "{{#gsc_daily.position}}"]);
  for (const r of [5, 10]) {
    numFmt(SC, r, 0, 2, "#,##0");
    numFmt(SC, r, 2, 3, "0.00%", "PERCENT");
    numFmt(SC, r, 3, 4, "0.00");
  }
  numFmt(SC, 10, 1, 3, "#,##0");
  numFmt(SC, 10, 3, 4, "0.00%", "PERCENT");
  numFmt(SC, 10, 4, 5, "0.00");
  headerRight(SC, 4, 0, 4);
  headerRight(SC, 9, 1, 5);
  tidy(SC, 0);

  // ── 07 Search Queries & 08 Search Pages: data r5.. → contoh r5
  for (const [sheet, table, label, last] of [
    ["07 Search Queries", "queries", "query", 65],
    ["08 Search Pages", "gsc_pages", "url", 113],
  ] as const) {
    del(sheet, 6, last);
    put(sheet, "A2", [`Web search · ${table === "queries" ? "top 100 queries" : "top 100 pages"} · {{period}} · rows may not sum to property totals`]);
    put(sheet, "A5", [`{{#${table}.${label}}}`, `{{#${table}.clicks}}`, `{{#${table}.impressions}}`, `{{#${table}.ctr}}`, `{{#${table}.position}}`]);
    numFmt(sheet, 5, 1, 3, "#,##0");
    numFmt(sheet, 5, 3, 4, "0.00%", "PERCENT");
    numFmt(sheet, 5, 4, 5, "0.00");
    headerRight(sheet, 4, 1, 5);
    tidy(sheet, 4);
  }

  // ── 09 GSC Devices & Countries: devices r5–7 → contoh r5; negara r12.. → contoh r12 (setelah hapus r6–7 → r10)
  const DC = "09 GSC Devices & Countries";
  if (lastRow(DC) >= 13) del(DC, 13, lastRow(DC));
  del(DC, 6, 7);
  put(DC, "A2", ["GSC Web search · {{period}} · search-result dimensions, not GA4 visitor dimensions"]);
  put(DC, "A5", ["{{#devices.name}}", "{{#devices.clicks}}", "{{#devices.impressions}}", "{{#devices.ctr}}", "—"]);
  put(DC, "A10", ["{{#countries.name}}", "{{#countries.clicks}}", "{{#countries.impressions}}", "{{#countries.ctr}}", "—"]);
  for (const r of [5, 10]) {
    numFmt(DC, r, 1, 3, "#,##0");
    numFmt(DC, r, 3, 4, "0.00%", "PERCENT");
  }
  headerRight(DC, 4, 1, 5);
  headerRight(DC, 9, 1, 5);
  headerRight(DC, 5, 4, 5); // "—" Avg Position
  headerRight(DC, 10, 4, 5);
  tidy(DC, 0);

  // ── 10 Metric Guide & Sources: catatan September dari ChatGPT diganti metodologi umum (berbasis API)
  const MG = "10 Metric Guide & Sources";
  // baris lama dipakai ulang (gayanya ikut): hapus header ganda r5, sisakan 17 baris isi (r6–r22 → r5–r21)
  if (lastRow(MG) >= 23) del(MG, 23, lastRow(MG));
  del(MG, 5, 5);
  put(MG, "A2", ["Methodology notes · GA4 website metrics are kept separate from Google Search Console search metrics"]);
  const guide: [string, string, string][] = [
    ["Scope", "Month", "{{period}}"],
    ["Source", "Google Analytics 4", "Main Ke Kudus property, pulled via the GA4 Data API for the full reporting month."],
    ["Source", "Google Search Console", "Web search, pulled via the Search Console API; property totals come from the API summary, not from summing rows."],
    ["Comparison", "Month-on-month", "KPI cards compare with {{prev_month_label}}; ↑/↓ colours follow whether the change is good (e.g. lower bounce rate is good)."],
    ["Coverage", "Pages and screens", "Totals cover all {{pages.count}} page paths; the table lists the top 10 by views."],
    ["Coverage", "Landing pages", "Totals cover all {{landing.count}} landing pages; the table lists the top 10 by sessions."],
    ["Coverage", "Cities", "Top 10 cities by active users. GA4 city attribution is approximate; “(not set)” means GA4 could not identify a city."],
    ["Coverage", "Search queries & pages", "Top 100 rows by clicks. Google omits anonymized queries, so rows may not sum to property totals."],
    ["Metric definition", "Active users", "Distinct users with an engaged session or first visit in the period."],
    ["Metric definition", "Sessions", "Visits across all channel groups; not the same as users."],
    ["Metric definition", "Views", "Page/screen views; not unique visitors."],
    ["Metric definition", "Engagement rate", "Engaged sessions ÷ sessions (GA4)."],
    ["Metric definition", "Bounce rate", "1 − engagement rate (GA4 definition)."],
    ["Metric definition", "Avg engagement time", "Average engaged time per session."],
    ["Metric definition", "GSC clicks vs GA4 sessions", "Search Console clicks and GA4 organic sessions measure different things and will not match."],
    ["Metric definition", "CTR / Avg position", "Clicks ÷ impressions; position is impression-weighted (lower is better)."],
    ["Data freshness", "Final figures", "The month is locked after its final sync, so figures in this report do not change afterwards."],
  ];
  guide.forEach((row, i) => put(MG, `A${5 + i}`, row));
  tidy(MG, 4);

  // ── 01 Executive Summary (diproses terakhir; baris dihapus bawah→atas)
  const ES = "01 Executive Summary";
  del(ES, 20, 26); // temuan r19–26 → contoh r19
  del(ES, 11, 16); // mix r10–16 → contoh r10
  del(ES, 4, 6); // strip KPI lama
  // setelah hapus: r4 kosong, r5 judul mix, r6 header mix, r7 contoh mix, r9 judul temuan, r10 contoh temuan, r12 coverage, r13 isi
  put(ES, "A1", ["MAIN KE KUDUS | WEBSITE MONTHLY PERFORMANCE REPORT · {{month_label}}"]);
  put(ES, "A2", ["Reporting period: {{period}} | Primary source: GA4 | Supporting search visibility: Google Search Console"]);
  put(ES, "A7", ["{{#mix.ch_name}}", "{{#mix.ch_sessions}}", "{{#mix.ch_share}}", "{{#mix.ch_er}}", "", "{{#mix.city_name}}", "{{#mix.city_users}}", "{{#mix.city_share}}", ""]);
  put(ES, "F6", ["City", "Active Users", "Share of Site", ""]);
  put(ES, "A10", ["{{#findings.text}}"]);
  put(ES, "A12", ["DATA NOTES"]);
  put(ES, "A13", ["All figures are pulled from the GA4 and Search Console APIs for {{period}}. City attribution in GA4 is approximate. Kudus: {{kudus_users}} active users."]);
  numFmt(ES, 7, 1, 2, "#,##0");
  numFmt(ES, 7, 2, 4, "0.0%", "PERCENT");
  numFmt(ES, 7, 6, 7, "#,##0");
  numFmt(ES, 7, 7, 8, "0.0%", "PERCENT");
  headerRight(ES, 6, 1, 4);
  headerRight(ES, 6, 6, 8);
  tidy(ES, 0);

  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
  await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data: values } });
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: formats } });

  // kartu: kolom A:B, C:D, E:F, G:I; baris kartu mulai r5, r10, r15 (label, nilai, perubahan, spasi)
  const KPIS = ["users", "new_users", "sessions", "views", "engagement_rate", "bounce_rate", "avg_engagement_time", "engaged_sessions", "gsc_clicks", "gsc_impressions", "gsc_ctr", "gsc_position"];
  const COLS: [number, number][] = [[0, 2], [2, 4], [4, 6], [6, 9]];
  const FMT: Record<string, [string, string]> = { engagement_rate: ["PERCENT", "0.00%"], bounce_rate: ["PERCENT", "0.00%"], gsc_ctr: ["PERCENT", "0.00%"], gsc_position: ["NUMBER", "0.0"] };
  // Blok kartu KPI disisipkan SETELAH semua nilai di atas ditulis (koordinat di atas memakai posisi sebelum sisipan):
  // 15 baris di r4 = 3 baris kartu × (label, nilai, perubahan, spasi) + spasi
  const cardReqs: Req[] = [{ insertDimension: { range: { sheetId: sid(ES), dimension: "ROWS", startIndex: 3, endIndex: 18 }, inheritFromBefore: false } }];
  const cardVals: { range: string; values: string[][] }[] = [];
  const cardFormats: Req[] = [];
  const white = { red: 1, green: 1, blue: 1 };
  const border = { style: "SOLID", color: { red: 0.85, green: 0.86, blue: 0.88 } };
  KPIS.forEach((k, i) => {
    const top = 4 + Math.floor(i / 4) * 5; // 0-based: r5, r10, r15
    const [c0, c1] = COLS[i % 4];
    const range = (r: number) => ({ sheetId: sid(ES), startRowIndex: top + r, endRowIndex: top + r + 1, startColumnIndex: c0, endColumnIndex: c1 });
    for (let r = 0; r < 3; r++) cardReqs.push({ mergeCells: { range: range(r), mergeType: "MERGE_ALL" } });
    cardReqs.push({
      updateBorders: { range: { sheetId: sid(ES), startRowIndex: top, endRowIndex: top + 3, startColumnIndex: c0, endColumnIndex: c1 }, top: border, bottom: border, left: border, right: border },
    });
    cardReqs.push({ repeatCell: { range: range(0), cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontSize: 9, foregroundColor: { red: 0.37, green: 0.39, blue: 0.41 } }, padding: { left: 8 } } }, fields: "userEnteredFormat(backgroundColor,textFormat,padding)" } });
    const [type, pattern] = FMT[k] ?? ["NUMBER", "#,##0"];
    cardReqs.push({ repeatCell: { range: range(1), cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontSize: 18, bold: true }, horizontalAlignment: "LEFT", padding: { left: 8 } } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)" } });
    cardFormats.push({ repeatCell: { range: range(1), cell: { userEnteredFormat: { numberFormat: { type, pattern } } }, fields: "userEnteredFormat.numberFormat" } });
    cardReqs.push({ repeatCell: { range: range(2), cell: { userEnteredFormat: { textFormat: { fontSize: 9 }, padding: { left: 8 } } }, fields: "userEnteredFormat(textFormat,padding)" } });
    const a = (r: number) => `'${ES}'!${String.fromCharCode(65 + c0)}${top + r + 1}`;
    cardVals.push({ range: a(0), values: [[`{{kpi.${k}.label}}`]] }, { range: a(1), values: [[`{{kpi.${k}.value}}`]] }, { range: a(2), values: [[`{{kpi.${k}.change}}`]] });
  });
  for (const [r, px] of [[1, 34]] as const) for (let b = 0; b < 3; b++) cardReqs.push({ updateDimensionProperties: { range: { sheetId: sid(ES), dimension: "ROWS", startIndex: 4 + b * 5 + r, endIndex: 5 + b * 5 + r }, properties: { pixelSize: px }, fields: "pixelSize" } });
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: cardReqs } });
  await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data: cardVals } });
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: cardFormats } });

  await patchText(c, id);
  await fitWidths(c, id);
  console.log(`Template dibuat: ${file.url}`);
  console.log(`Isi di .env.local: REPORT_TEMPLATE_WEBSITE=${id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
