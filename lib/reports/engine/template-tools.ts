// Alat bantu script master template (scripts/report-template-*.ts): dipakai saat membuat/merapikan template, bukan saat generate.
import type { ReportClients } from "./sheets";

type Req = Record<string, unknown>;

/**
 * Lebar total kolom terpakai di setiap sheet (px). Export PDF "fit to width" hanya mengecilkan konten yang lebih
 * lebar dari halaman, tidak membesarkan yang sempit — jadi semua sheet disamakan dengan 05 Landing Pages Website
 * (1.087 px, pas penuh di A4 landscape) supaya tiap halaman penuh kiri–kanan dengan ukuran huruf yang sama.
 */
export const PAGE_WIDTH_PX = 1087;

/** Skala lebar kolom terpakai tiap sheet yang tampil secara proporsional sampai totalnya PAGE_WIDTH_PX. */
export async function fitWidths(c: ReportClients, id: string) {
  const r = await c.sheets.spreadsheets.get({
    spreadsheetId: id,
    includeGridData: true,
    fields: "sheets(properties(sheetId,title,hidden),merges,data(columnMetadata(pixelSize),rowData(values(userEnteredValue))))",
  });
  const requests: Req[] = [];
  for (const sh of r.data.sheets ?? []) {
    if (sh.properties!.hidden) continue; // tidak ikut PDF
    const d = sh.data![0];
    let last = 0;
    (d.rowData ?? []).forEach((row) => (row.values ?? []).forEach((v, j) => v.userEnteredValue && (last = Math.max(last, j))));
    for (const m of sh.merges ?? []) last = Math.max(last, (m.endColumnIndex ?? 1) - 1);
    const widths = (d.columnMetadata ?? []).slice(0, last + 1).map((m) => m.pixelSize ?? 100);
    const total = widths.reduce((a, b) => a + b, 0);
    const scaled = widths.map((w) => Math.round((w * PAGE_WIDTH_PX) / total));
    scaled[scaled.length - 1] += PAGE_WIDTH_PX - scaled.reduce((a, b) => a + b, 0); // sisa pembulatan
    scaled.forEach((px, col) =>
      requests.push({ updateDimensionProperties: { range: { sheetId: sh.properties!.sheetId!, dimension: "COLUMNS", startIndex: col, endIndex: col + 1 }, properties: { pixelSize: px }, fields: "pixelSize" } }),
    );
    console.log(`${sh.properties!.title}: ${total} → ${PAGE_WIDTH_PX} px`);
  }
  if (requests.length) await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
}
