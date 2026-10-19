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

/**
 * Gaya baris standar semua laporan (dasar: laporan News). Tinggi px + ukuran huruf; peran baris ditentukan per
 * template di script-nya. "text" = kalimat panjang: tinggi menyesuaikan isi, minimal `px`.
 */
export const ROW_STYLE = {
  reportTitle: { px: 64, fs: 20 },
  sheetTitle: { px: 40, fs: 18 },
  subtitle: { px: 32, fs: 10 },
  section: { px: 30, fs: 10 },
  header: { px: 36, fs: 10 },
  row: { px: 32, fs: 10 },
  text: { px: 32, fs: 10 },
  cardLabel: { px: 20, fs: 9 },
  cardValue: { px: 34, fs: 18 },
} as const;
export type RowRole = keyof typeof ROW_STYLE;

/** Peran baris per sheet: [peran, baris (1-based) atau [dari, sampai]]. */
export type RowStyleSpec = Record<string, [RowRole, number | [number, number]][]>;

/**
 * Pasang ROW_STYLE ke template: tinggi baris + ukuran huruf + rata tengah vertikal (format lain tidak disentuh). Baris awal merge vertikal
 * (mis. judul A1:A2) → tinggi dibagi rata ke baris-baris merge. Baris "text" di-auto-fit lalu dinaikkan ke minimal.
 */
export async function applyRowStyles(c: ReportClients, id: string, spec: RowStyleSpec) {
  const r = await c.sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets(properties(sheetId,title,gridProperties(columnCount)),merges)" });
  const sheets = new Map((r.data.sheets ?? []).map((s) => [s.properties!.title!, s]));
  const requests: Req[] = [];
  const fitRows: { sheetId: number; row: number }[] = [];
  const height = (sheetId: number, r0: number, r1: number, px: number) =>
    requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: r0, endIndex: r1 }, properties: { pixelSize: px }, fields: "pixelSize" } });
  for (const [title, roles] of Object.entries(spec)) {
    const sh = sheets.get(title);
    if (!sh) throw new Error(`Sheet "${title}" tidak ada`);
    const sheetId = sh.properties!.sheetId!;
    const cols = sh.properties!.gridProperties!.columnCount!;
    for (const [role, rows] of roles) {
      const { px, fs } = ROW_STYLE[role];
      const [from, to] = typeof rows === "number" ? [rows, rows] : rows;
      for (let row = from - 1; row < to; row++) {
        const span = (sh.merges ?? []).find((m) => m.startRowIndex === row && m.endRowIndex! - row > 1);
        const n = span ? span.endRowIndex! - row : 1;
        height(sheetId, row, row + n, Math.round(px / n));
        if (role === "text") fitRows.push({ sheetId, row });
      }
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: from - 1, endRowIndex: to, startColumnIndex: 0, endColumnIndex: cols },
          // teks rata tengah vertikal di semua baris (template contoh kadang campur bawah/tengah)
          cell: { userEnteredFormat: { textFormat: { fontSize: fs }, verticalAlignment: "MIDDLE" } },
          fields: "userEnteredFormat(textFormat.fontSize,verticalAlignment)",
        },
      });
    }
  }
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
  await fitTextRows(c, id, fitRows, ROW_STYLE.text.px);
}

/**
 * Perkiraan tinggi baris dari teks ber-wrap: kata dibungkus per lebar sel (termasuk merge) dengan lebar huruf rata-rata.
 * Perlu karena autoResizeDimensions mengabaikan sel merge (judul/URL di tabel News → 20 px, teks terpotong).
 */
export function estimateRowPx(cells: { text: string; widthPx: number; fontPt: number }[]): number {
  let lines = 1;
  let line = 15;
  for (const c of cells) {
    const em = (c.fontPt * 4) / 3;
    const max = c.widthPx - 8; // padding sel
    const charPx = em * 0.5;
    let n = 1;
    let cur = 0;
    // titik potong baris: spasi, tanda hubung, garis miring (URL)
    for (const word of c.text.split(/(?<=[\s\-/])/)) {
      const w = word.length * charPx;
      if (cur + w > max && cur > 0) {
        n++;
        cur = 0;
      }
      cur += w;
    }
    if (n > lines) [lines, line] = [n, Math.round(em * 1.15)];
  }
  return lines * line + 2;
}

/**
 * Auto-fit tinggi baris sesuai isi, lalu tinggi = maks(hasil auto-fit, perkiraan teks ber-wrap, `minPx`).
 */
export async function fitTextRows(c: ReportClients, id: string, rows: { sheetId: number; row: number }[], minPx: number) {
  if (!rows.length) return;
  await c.sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests: rows.map((x) => ({ autoResizeDimensions: { dimensions: { sheetId: x.sheetId, dimension: "ROWS", startIndex: x.row, endIndex: x.row + 1 } } })) },
  });
  const r = await c.sheets.spreadsheets.get({
    spreadsheetId: id,
    includeGridData: true,
    fields: "sheets(properties(sheetId),merges,data(columnMetadata(pixelSize),rowMetadata(pixelSize),rowData(values(formattedValue,effectiveFormat(wrapStrategy,textFormat(fontSize))))))",
  });
  const sheets = new Map((r.data.sheets ?? []).map((s) => [s.properties!.sheetId!, s]));
  const requests: Req[] = [];
  for (const x of rows) {
    const sh = sheets.get(x.sheetId);
    const d = sh?.data?.[0];
    const colPx = (i: number) => d?.columnMetadata?.[i]?.pixelSize ?? 100;
    const cells = (d?.rowData?.[x.row]?.values ?? []).flatMap((v, j) => {
      if (!v.formattedValue || v.effectiveFormat?.wrapStrategy !== "WRAP") return [];
      const m = sh?.merges?.find((mm) => mm.startRowIndex === x.row && mm.startColumnIndex === j);
      let widthPx = 0;
      for (let k = j; k < (m?.endColumnIndex ?? j + 1); k++) widthPx += colPx(k);
      return [{ text: v.formattedValue, widthPx, fontPt: v.effectiveFormat?.textFormat?.fontSize ?? 10 }];
    });
    const auto = d?.rowMetadata?.[x.row]?.pixelSize ?? 0;
    const px = Math.max(minPx, auto, estimateRowPx(cells));
    if (px !== auto)
      requests.push({ updateDimensionProperties: { range: { sheetId: x.sheetId, dimension: "ROWS", startIndex: x.row, endIndex: x.row + 1 }, properties: { pixelSize: px }, fields: "pixelSize" } });
  }
  if (requests.length) await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
}
