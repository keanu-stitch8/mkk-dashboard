import type { sheets_v4 } from "googleapis";
import { CONTRIBUTOR_KPIS } from "../channels/contributors-data";
import { PAGE_WIDTH_PX, ROW_STYLE } from "./template-tools";

export const CONTRIBUTOR_SHEETS = ["01 Executive Summary", "02 Delivery Log", "03 Monthly Recap", "04 Metric Guide"] as const;
type Source = { properties?: sheets_v4.Schema$SheetProperties; charts?: { chartId?: number | null }[] };

/** Copy the current master first. Preserve its title band, card blocks, widths and spacing exactly. */
export function contributorTemplatePlan(sheets: Source[]) {
  const summary = sheets.find((s) => s.properties?.title === CONTRIBUTOR_SHEETS[0]);
  if (summary?.properties?.sheetId == null || (summary.properties.gridProperties?.rowCount ?? 0) < 13)
    throw new Error("The reference must contain 01 Executive Summary with the standard eight KPI cards.");
  const used = new Set(sheets.map((s) => s.properties?.sheetId));
  const ids = [summary.properties.sheetId];
  for (let id = 1; ids.length < 4; id++) if (!used.has(id)) ids.push(id);
  const requests: sheets_v4.Schema$Request[] = [];
  const data: sheets_v4.Schema$ValueRange[] = [];
  const formats: sheets_v4.Schema$Request[] = [];
  const range = (s: number, row: number, c0 = 0, c1 = 12) => ({ sheetId: ids[s], startRowIndex: row - 1, endRowIndex: row, startColumnIndex: c0, endColumnIndex: c1 });
  const put = (s: number, row: number, col: number, value: string) => data.push({ range: `'${CONTRIBUTOR_SHEETS[s]}'!${String.fromCharCode(65 + col)}${row}`, values: [[value]] });
  const rgb = (hex: string) => ({ red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 });
  const merge = (s: number, row: number, c0 = 0, c1 = 12, rowSpan = 1) => requests.push({ mergeCells: { range: { ...range(s, row, c0, c1), endRowIndex: row - 1 + rowSpan }, mergeType: "MERGE_ALL" } });
  const style = (s: number, row: number, role: "sheetTitle" | "subtitle" | "section" | "header" | "row" | "text") => {
    const st = ROW_STYLE[role];
    // Social Media detail pages merge A1:M2: two 20px rows, followed immediately by the subtitle.
    const span = role === "sheetTitle" ? 2 : 1;
    const styledRange = { ...range(s, row), endRowIndex: row - 1 + span };
    formats.push({ updateDimensionProperties: { range: { sheetId: ids[s], dimension: "ROWS", startIndex: row - 1, endIndex: row - 1 + span }, properties: { pixelSize: st.px / span }, fields: "pixelSize" } });
    const color = "bg" in st ? st.bg : "#ffffff";
    const edge = (hex: string) => ({ style: "SOLID", color: rgb(hex) });
    formats.push({ repeatCell: { range: styledRange, cell: { userEnteredFormat: {
      textFormat: { fontFamily: "Carlito", fontSize: st.fs, bold: "bold" in st ? st.bold : false, italic: "italic" in st ? st.italic : false, foregroundColor: rgb(st.fg) },
      backgroundColor: rgb(color), verticalAlignment: "MIDDLE", wrapStrategy: role === "sheetTitle" ? "OVERFLOW_CELL" : role === "header" ? "CLIP" : "WRAP",
      ...("hAlign" in st ? { horizontalAlignment: st.hAlign } : {}),
      ...(role === "sheetTitle" || role === "subtitle" ? { padding: { top: 0, bottom: 0, left: 3, right: 3 } } : {}),
      ...(role === "header" ? { padding: { top: 0, bottom: 0, left: 0, right: 0 } } : {}),
      ...("bottom" in st ? { borders: { bottom: { style: st.bottom.style, color: rgb(st.bottom.color) } } } : {}),
      ...(role === "sheetTitle" ? { borders: { bottom: edge(color), left: edge(color), right: edge(color) } } : {}),
      ...(role === "subtitle" ? { borders: { bottom: edge("#ffffff"), left: edge("#ffffff") } } : {}),
    } }, fields: "userEnteredFormat" } });
  };
  const number = (s: number, row: number, c0: number, c1: number, percent = false) => formats.push({ repeatCell: { range: range(s, row, c0, c1), cell: { userEnteredFormat: { horizontalAlignment: "RIGHT", numberFormat: { type: percent ? "PERCENT" : "NUMBER", pattern: percent ? "0.0%" : "#,##0" } } }, fields: "userEnteredFormat(horizontalAlignment,numberFormat)" } });

  sheets.forEach((s) => (s.charts ?? []).forEach((ch) => requests.push({ deleteEmbeddedObject: { objectId: ch.chartId } })));
  sheets.filter((s) => s !== summary).forEach((s) => requests.push({ deleteSheet: { sheetId: s.properties!.sheetId } }));
  const rows = summary.properties.gridProperties!.rowCount!;
  if (rows > 13) requests.push({ deleteDimension: { range: { sheetId: ids[0], dimension: "ROWS", startIndex: 13, endIndex: rows } } });
  requests.push({ appendDimension: { sheetId: ids[0], dimension: "ROWS", length: 6 } });
  for (let s = 1; s < 4; s++) {
    requests.push({ addSheet: { properties: { sheetId: ids[s], title: CONTRIBUTOR_SHEETS[s], gridProperties: { rowCount: s === 3 ? 20 : 10, columnCount: 12, hideGridlines: true, frozenRowCount: s === 3 ? 0 : 5 } } } });
    for (let col = 0; col < 12; col++) requests.push({ updateDimensionProperties: { range: { sheetId: ids[s], dimension: "COLUMNS", startIndex: col, endIndex: col + 1 }, properties: { pixelSize: col === 11 ? PAGE_WIDTH_PX - 91 * 11 : 91 }, fields: "pixelSize" } });
  }
  requests.push({ updateSpreadsheetProperties: { properties: { locale: "in_ID", timeZone: "Asia/Jakarta" }, fields: "locale,timeZone" } });
  put(0, 1, 0, "MAIN KE KUDUS | LOCAL CONTRIBUTOR MONTHLY PERFORMANCE REPORT - {{month_label}}");
  put(0, 2, 0, "Reporting period: {{period}} · Source: Local Contributor Task Progress and Master Report");
  CONTRIBUTOR_KPIS.forEach((k, i) => {
    const row = i < 4 ? 4 : 9;
    const col = (i % 4) * 3;
    ["label", "value", "change"].forEach((field, j) => put(0, row + j, col, `{{kpi.${k.key}.${field}}}`));
    // Replace the source metric's number format (CTR, watch hours etc.).
    formats.push({ repeatCell: { range: range(0, row + 1, col, col + 3), cell: { userEnteredFormat: { numberFormat: { type: k.kind === "rate" ? "PERCENT" : "NUMBER", pattern: k.kind === "rate" ? "0.0%" : "#,##0" } } }, fields: "userEnteredFormat.numberFormat" } });
  });
  put(0, 14, 0, "KEY FINDINGS"); merge(0, 14); style(0, 14, "section");
  put(0, 15, 0, "{{#findings.text}}"); merge(0, 15); style(0, 15, "text");
  put(0, 17, 0, "DELIVERY BASIS"); merge(0, 17); style(0, 17, "section");
  put(0, 18, 0, "One delivered content is one item marked Submitted, including Extra Posts. Media availability does not affect the delivery count."); merge(0, 18); style(0, 18, "text");

  const table = (s: number, title: string, subtitle: string, headers: string[], keys: string[], tableName: string) => {
    put(s, 1, 0, title); merge(s, 1, 0, 12, 2); style(s, 1, "sheetTitle");
    put(s, 3, 0, subtitle); merge(s, 3); style(s, 3, "subtitle");
    const starts = [0, 4, 6, 8, 10];
    for (const row of [5, 6]) {
      starts.forEach((col, i) => { merge(s, row, col, starts[i + 1] ?? 12); put(s, row, col, row === 5 ? headers[i] : `{{#${tableName}.${keys[i]}}}`); });
      style(s, row, row === 5 ? "header" : "row");
    }
    number(s, 6, 4, 12);
    formats.push({ repeatCell: { range: range(s, 5, 4, 12), cell: { userEnteredFormat: { horizontalAlignment: "RIGHT" } }, fields: "userEnteredFormat.horizontalAlignment" } });
    formats.push({ repeatCell: { range: { ...range(s, 5), endRowIndex: 6 }, cell: { userEnteredFormat: { padding: { top: 2, bottom: 2, left: 3, right: 3 } } }, fields: "userEnteredFormat.padding" } });
  };
  put(1, 1, 0, "DELIVERY LOG · {{month_upper}}"); merge(1, 1, 0, 12, 2); style(1, 1, "sheetTitle");
  put(1, 3, 0, "Planned stories, submission status and media availability for {{month_label}}. Extra Posts are included."); merge(1, 3); style(1, 3, "subtitle");
  const logCols = [0, 1, 2, 6, 8, 9, 10, 11];
  const logHeaders = ["No.", "Planned", "Story", "Status", "Submitted", "Portrait photo", "Portrait video", "Interview video"];
  const logKeys = ["no", "planned", "title", "status", "submitted", "portrait", "video", "interview"];
  for (const row of [5, 6]) {
    logCols.forEach((col, i) => { const end = logCols[i + 1] ?? 12; if (end - col > 1) merge(1, row, col, end); put(1, row, col, row === 5 ? logHeaders[i] : `{{#log.${logKeys[i]}}}`); });
    style(1, row, row === 5 ? "header" : "row");
  }
  [34, 86, 120, 120, 120, 120, 70, 70, 98, 83, 83, 83].forEach((pixelSize, col) => formats.push({ updateDimensionProperties: { range: { sheetId: ids[1], dimension: "COLUMNS", startIndex: col, endIndex: col + 1 }, properties: { pixelSize }, fields: "pixelSize" } }));
  for (const col of [1, 8]) formats.push({ repeatCell: { range: range(1, 6, col, col + 1), cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd mmm yyyy" } } }, fields: "userEnteredFormat.numberFormat" } });
  formats.push({ repeatCell: { range: { ...range(1, 5, 0, 2), endRowIndex: 10 }, cell: { userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)" } });
  formats.push({ repeatCell: { range: { ...range(1, 5, 6, 9), endRowIndex: 10 }, cell: { userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)" } });
  formats.push({ repeatCell: { range: { ...range(1, 6, 8, 12), endRowIndex: 10 }, cell: { userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)" } });
  table(2, "MONTHLY RECAP · {{month_upper}}", "Delivery against the team quota, through {{month_label}}. Extra Posts are included.",
    ["Month", "Delivered", "Monthly quota", "Achievement", "Remaining"], ["month", "delivered", "quota", "achievement", "remaining"], "recap");
  number(2, 6, 8, 10, true);

  const guide = [
    ["Delivered vs quota", "Items marked Submitted in the monthly tab and its Extra Posts tab, against a team quota of 60.", "Tracks monthly delivery."],
    ["Quota achievement", "Delivered content divided by 60. It can exceed 100%.", "Measures target completion."],
    ["Remaining quota", "60 minus delivered content, with a minimum of zero.", "Shows the delivery gap."],
    ["Extra content delivered", "Submitted content from the month's Extra Posts tab. Already included in delivered content.", "Identifies additional output."],
    ["Stories with portrait photos", "Stories with portrait photo status Available. Each story counts once.", "Tracks photo availability."],
    ["Stories with portrait video", "Stories with portrait video status Available. Each story counts once.", "Tracks video availability."],
    ["Stories with interview video", "Stories with interview video status Available. Each story counts once.", "Tracks interview availability."],
    ["Stories with footage available", "Stories with at least one portrait photo, portrait video or interview video marked Available. Each story counts once.", "Tracks media coverage."],
    ["Delivery log", "Planned stories and Extra Posts. Waiting means no submission status is recorded. Media: Available, N/A (unavailable), or a dash (not recorded).", "Tracks delivery progress."],
    ["Month-on-month", "KPI changes compare with {{prev_month_label}}. Media groups with no recorded status are untracked. A missing previous month has no comparison.", "Avoids treating missing data as zero."],
  ];
  put(3, 1, 0, "METRIC GUIDE · {{month_upper}}"); merge(3, 1, 0, 12, 2); style(3, 1, "sheetTitle");
  put(3, 3, 0, "How the KPI figures in this report are defined"); merge(3, 3); style(3, 3, "subtitle");
  [["Metric", "Definition", "Purpose"], ...guide].forEach((cells, i) => {
    const row = i + 5;
    [0, 3, 9].forEach((col, j) => { merge(3, row, col, [3, 9, 12][j]); put(3, row, col, cells[j]); });
    style(3, row, i === 0 ? "header" : "row");
    if (i > 0) formats.push({ updateDimensionProperties: { range: { sheetId: ids[3], dimension: "ROWS", startIndex: row - 1, endIndex: row }, properties: { pixelSize: 44 }, fields: "pixelSize" } });
  });
  return { requests, data, formats };
}
