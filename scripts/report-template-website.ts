// Sekali jalan: buat master template laporan Website dari laporan September user.
// npx tsx scripts/report-template-website.ts --from=<ID file laporan contoh>
// Sumber hanya DISALIN (file user tidak diubah); semua perubahan di file baru milik app.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

type Req = Record<string, unknown>;

async function main() {
  const from = process.argv.find((a) => a.startsWith("--from="))?.split("=")[1];
  if (!from) throw new Error("--from=<ID laporan September> wajib");
  const { reportClients, copyFile, readGrids } = await import("../lib/reports/engine/sheets");
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
  const numFmt = (sheet: string, r1: number, c0: number, c1: number, pattern: string, type = "NUMBER") =>
    requests.push({
      repeatCell: {
        range: { sheetId: sid(sheet), startRowIndex: r1 - 1, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 },
        cell: { userEnteredFormat: { numberFormat: { type, pattern }, horizontalAlignment: "RIGHT" } },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
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
  tidy(TA, 4);

  // ── 03 Visitor Cities: data r5–11 → contoh r5; total r12; site r14; gap r15; readout r18–21 → contoh r18
  const VC = "03 Visitor Cities";
  del(VC, 19, 21);
  del(VC, 6, 11);
  put(VC, "A2", ["GA4 · Active users by city · {{period}} · top 10 cities"]);
  put(VC, "A4", ["Rank", "City", "Active Users", "Share of Site Active Users", "Share of Cities Shown", "Audience Readout", "Data Quality Note"]);
  put(VC, "A5", ["{{#cities.rank}}", "{{#cities.city}}", "{{#cities.users}}", "{{#cities.share_site}}", "{{#cities.share_shown}}", "{{#cities.readout}}", "{{#cities.note}}"]);
  put(VC, "A6", ["", "CITIES SHOWN", "{{cities.shown_users}}", "{{cities.shown_share}}", 1, "Sum of the city rows shown.", "Not an exhaustive city list."]);
  put(VC, "A8", ["SITE-WIDE ACTIVE USERS", "", "{{pages.total_users}}", 1, "", "GA4 site-wide active users."]);
  put(VC, "A9", ["GAP VS CITIES SHOWN", "", "{{cities.gap_users}}", "{{cities.gap_share}}", "", "Users in cities outside the list shown (or unattributed)."]);
  put(VC, "A12", ["{{#geo.text}}"]);
  for (const r of [5, 6, 8, 9]) {
    numFmt(VC, r, 2, 3, "#,##0");
    numFmt(VC, r, 3, 5, "0.0%", "PERCENT");
  }
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
  tidy(PP, 4);

  // ── 05 Landing Pages: total r5, data r6–15 → contoh r6
  const LP = "05 Landing Pages";
  del(LP, 7, 15);
  put(LP, "A2", ["GA4 · total plus top 10 of {{landing.count}} landing pages · {{period}}"]);
  put(LP, "A5", ["TOTAL (all {{landing.count}} landing pages)", "{{landing.total_sessions}}", "{{landing.total_users}}", "{{landing.total_new_users}}", "{{landing.total_avg_time}}"]);
  put(LP, "A6", ["{{#landing.path}}", "{{#landing.sessions}}", "{{#landing.users}}", "{{#landing.new_users}}", "{{#landing.avg_time}}"]);
  for (const r of [5, 6]) {
    numFmt(LP, r, 1, 4, "#,##0");
    numFmt(LP, r, 4, 5, '0" sec"');
  }
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
  tidy(DC, 0);

  // ── 10 Metric Guide & Sources: periode
  put("10 Metric Guide & Sources", "C6", ["{{period}}"]);
  tidy("10 Metric Guide & Sources", 4);

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
  tidy(ES, 0);

  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
  await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data: values } });

  // kartu: kolom A:B, C:D, E:F, G:I; baris kartu mulai r5, r10, r15 (label, nilai, perubahan, spasi)
  const KPIS = ["users", "new_users", "sessions", "views", "engagement_rate", "bounce_rate", "avg_engagement_time", "engaged_sessions", "gsc_clicks", "gsc_impressions", "gsc_ctr", "gsc_position"];
  const COLS: [number, number][] = [[0, 2], [2, 4], [4, 6], [6, 9]];
  const FMT: Record<string, [string, string]> = { engagement_rate: ["PERCENT", "0.00%"], bounce_rate: ["PERCENT", "0.00%"], gsc_ctr: ["PERCENT", "0.00%"], gsc_position: ["NUMBER", "0.0"] };
  // Blok kartu KPI disisipkan SETELAH semua nilai di atas ditulis (koordinat di atas memakai posisi sebelum sisipan):
  // 15 baris di r4 = 3 baris kartu × (label, nilai, perubahan, spasi) + spasi
  const cardReqs: Req[] = [{ insertDimension: { range: { sheetId: sid(ES), dimension: "ROWS", startIndex: 3, endIndex: 18 }, inheritFromBefore: false } }];
  const cardVals: { range: string; values: string[][] }[] = [];
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
    cardReqs.push({ repeatCell: { range: range(1), cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontSize: 18, bold: true }, horizontalAlignment: "LEFT", padding: { left: 8 }, numberFormat: { type, pattern } } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding,numberFormat)" } });
    cardReqs.push({ repeatCell: { range: range(2), cell: { userEnteredFormat: { textFormat: { fontSize: 9 }, padding: { left: 8 } } }, fields: "userEnteredFormat(textFormat,padding)" } });
    const a = (r: number) => `'${ES}'!${String.fromCharCode(65 + c0)}${top + r + 1}`;
    cardVals.push({ range: a(0), values: [[`{{kpi.${k}.label}}`]] }, { range: a(1), values: [[`{{kpi.${k}.value}}`]] }, { range: a(2), values: [[`{{kpi.${k}.change}}`]] });
  });
  for (const [r, px] of [[1, 34]] as const) for (let b = 0; b < 3; b++) cardReqs.push({ updateDimensionProperties: { range: { sheetId: sid(ES), dimension: "ROWS", startIndex: 4 + b * 5 + r, endIndex: 5 + b * 5 + r }, properties: { pixelSize: px }, fields: "pixelSize" } });
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: cardReqs } });
  await c.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: "RAW", data: cardVals } });

  console.log(`Template dibuat: ${file.url}`);
  console.log(`Isi di .env.local: REPORT_TEMPLATE_WEBSITE=${id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
