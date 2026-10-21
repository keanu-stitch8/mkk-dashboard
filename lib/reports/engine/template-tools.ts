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

const FONT = "Carlito";
const WHITE = "#ffffff";
const DARK = "#1f2329";
const ORANGE = "#ff4d00";
const INK = "#2b2f36";
const MUTED = "#667085";
const LINE = "#d0d5dd";

interface RowStyle {
  px: number;
  fs: number;
  bold?: boolean;
  italic?: boolean;
  fg?: string;
  bg?: string;
  hAlign?: "LEFT" | "CENTER" | "RIGHT";
  wrap?: boolean;
  /** garis bawah tiap sel berisi */
  bottom?: { style: "SOLID" | "SOLID_MEDIUM"; color: string };
  /** garis semua sisi (termasuk antar sel) sewarna latar → bar tanpa celah */
  box?: string;
  /** satu teks di kolom A → merge selebar sheet (seperti judul/bar Website) */
  fullWidth?: boolean;
  /** tinggi menyesuaikan isi, minimal `px` */
  fit?: boolean;
}

/**
 * Gaya baris standar semua laporan (dasar: laporan Website): tinggi, huruf, warna, rata, garis. Peran baris ditentukan
 * per template di script-nya. Rata horizontal tabel tidak diubah (teks kiri, angka kanan per kolom).
 */
export const ROW_STYLE = {
  reportTitle: { px: 64, fs: 20, bold: true, fg: WHITE, bg: DARK, hAlign: "LEFT", box: DARK, fullWidth: true },
  sheetTitle: { px: 40, fs: 18, bold: true, fg: WHITE, bg: DARK, hAlign: "LEFT", box: DARK, fullWidth: true },
  subtitle: { px: 32, fs: 10, bold: false, italic: true, fg: MUTED, hAlign: "LEFT", wrap: true, fullWidth: true },
  section: { px: 30, fs: 10, bold: true, italic: false, fg: WHITE, bg: DARK, hAlign: "LEFT", box: DARK, fullWidth: true },
  header: { px: 36, fs: 10, bold: true, italic: false, fg: WHITE, bg: ORANGE, wrap: true, bottom: { style: "SOLID_MEDIUM", color: ORANGE } },
  row: { px: 32, fs: 10, italic: false, fg: INK, bottom: { style: "SOLID", color: LINE } },
  /** baris TOTAL tabel: tebal di latar oranye muda */
  total: { px: 32, fs: 10, bold: true, italic: false, fg: DARK, bg: "#fff0e9", bottom: { style: "SOLID", color: LINE } },
  text: { px: 32, fs: 10, italic: false, fg: INK, wrap: true, bottom: { style: "SOLID", color: LINE }, fullWidth: true, fit: true },
  /** catatan berwarna (kotak NOTES Website): warna dari template tetap */
  note: { px: 32, fs: 10, wrap: true, fullWidth: true, fit: true },
  cardLabel: { px: 20, fs: 9 },
  cardValue: { px: 34, fs: 18 },
} satisfies Record<string, RowStyle>;
/** "autoFit": hanya tinggi = sesuai isi (Sheets auto-fit), format tidak disentuh */
export type RowRole = keyof typeof ROW_STYLE | "autoFit";

/** Peran baris per sheet: [peran, baris (1-based) atau [dari, sampai], opsional kolom (1-based) [dari, sampai]]. */
export type RowStyleSpec = Record<string, ([RowRole, number | [number, number]] | [RowRole, number | [number, number], [number, number]])[]>;

const rgb = (hex: string) => ({ red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 });

/**
 * Pasang ROW_STYLE ke template (format lain seperti format angka tidak disentuh). Huruf semua sel = Carlito.
 * Gaya dipasang ke tiap sel berisi (beserta merge-nya), jadi celah antar tabel berdampingan tetap kosong.
 * Baris awal merge vertikal (mis. judul A1:A2) → tinggi dibagi rata ke baris-baris merge.
 */
export async function applyRowStyles(c: ReportClients, id: string, spec: RowStyleSpec) {
  const r = await c.sheets.spreadsheets.get({
    spreadsheetId: id,
    includeGridData: true,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount)),merges,data(rowData(values(formattedValue))))",
  });
  const sheets = new Map((r.data.sheets ?? []).map((s) => [s.properties!.title!, s]));
  const structural: Req[] = [];
  const requests: Req[] = [];
  const fitRows: { sheetId: number; row: number }[] = [];
  const autoRows: Req[] = [];
  for (const [title, roles] of Object.entries(spec)) {
    const sh = sheets.get(title);
    if (!sh) throw new Error(`Sheet "${title}" doesn't exist`);
    const sheetId = sh.properties!.sheetId!;
    const merges = sh.merges ?? [];
    const rowsData = sh.data?.[0]?.rowData ?? [];
    // penanda {{pagebreak}} bukan isi (dikosongkan saat generate), tapi ikut diberi gaya baris
    const marker = (row: number) => (rowsData[row]?.values ?? []).findIndex((v) => v.formattedValue === "{{pagebreak}}");
    const filled = (row: number) => (rowsData[row]?.values ?? []).flatMap((v, j) => (v.formattedValue && v.formattedValue !== "{{pagebreak}}" ? [j] : []));
    let used = 0;
    rowsData.forEach((_, i) => [...filled(i), marker(i)].forEach((j) => (used = Math.max(used, j + 1))));
    merges.forEach((m) => (used = Math.max(used, m.endColumnIndex!)));
    const range = (r0: number, r1: number, c0: number, c1: number) => ({ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
    // huruf seragam di seluruh area terpakai
    requests.push({ repeatCell: { range: range(0, sh.properties!.gridProperties!.rowCount!, 0, used), cell: { userEnteredFormat: { textFormat: { fontFamily: FONT } } }, fields: "userEnteredFormat.textFormat.fontFamily" } });
    for (const [role, rows, colLimit] of roles) {
      const [from, to] = typeof rows === "number" ? [rows, rows] : rows;
      if (role === "autoFit") {
        autoRows.push({ autoResizeDimensions: { dimensions: { sheetId, dimension: "ROWS", startIndex: from - 1, endIndex: to } } });
        continue;
      }
      const st: RowStyle = ROW_STYLE[role];
      for (let row = from - 1; row < to; row++) {
        const vspan = merges.find((m) => m.startRowIndex === row && m.endRowIndex! - row > 1);
        const n = vspan ? vspan.endRowIndex! - row : 1;
        requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: row, endIndex: row + n }, properties: { pixelSize: Math.round(st.px / n) }, fields: "pixelSize" } });
        if (st.fit) fitRows.push({ sheetId, row });
        const cols = filled(row);
        // potongan sel berisi: [kolom awal, kolom akhir) termasuk merge
        let spans = cols.filter((j) => !colLimit || (j >= colLimit[0] - 1 && j < colLimit[1])).map((j) => {
          const m = merges.find((mm) => mm.startRowIndex === row && mm.startColumnIndex === j);
          return [j, m ? m.endColumnIndex! : j + 1] as [number, number];
        });
        // baris TOTAL: satu blok utuh selebar tabel (kolom kosong di tengah ikut berwarna)
        if (role === "total" && spans.length)
          spans = colLimit ? [[colLimit[0] - 1, colLimit[1]]] : [[Math.min(...spans.map((s) => s[0])), Math.max(...spans.map((s) => s[1]))]];
        if (st.fullWidth && !colLimit && cols.length === 1 && cols[0] === 0) {
          const end = marker(row) > 0 ? marker(row) : used; // sel penanda tidak ikut merge (isinya akan hilang)
          structural.push({ unmergeCells: { range: range(row, row + n, 0, used) } }, { mergeCells: { range: range(row, row + n, 0, end), mergeType: "MERGE_ALL" } });
          spans = [[0, used]];
        }
        // hanya properti yang didefinisikan gaya ini yang ditulis (field mask), sisanya format template tetap
        const tf: Record<string, unknown> = { fontSize: st.fs };
        if (st.bold != null) tf.bold = st.bold;
        if (st.italic != null) tf.italic = st.italic;
        if (st.fg) tf.foregroundColor = rgb(st.fg);
        const fmt: Record<string, unknown> = { textFormat: tf, verticalAlignment: "MIDDLE" };
        if (st.bg) fmt.backgroundColor = rgb(st.bg);
        if (st.hAlign) fmt.horizontalAlignment = st.hAlign;
        if (st.wrap) fmt.wrapStrategy = "WRAP";
        const fields = [`textFormat(${Object.keys(tf).join(",")})`, ...Object.keys(fmt).filter((k) => k !== "textFormat")];
        for (const [c0, c1] of spans) {
          requests.push({ repeatCell: { range: range(row, row + n, c0, c1), cell: { userEnteredFormat: fmt }, fields: `userEnteredFormat(${fields.join(",")})` } });
          if (st.box) {
            const b = { style: "SOLID", color: rgb(st.box) };
            // tanpa garis atas: tepi atas = tepi bawah baris sebelumnya (tercetak sebagai garis di akhir halaman sebelumnya)
            requests.push({ updateBorders: { range: range(row, row + n, c0, c1), top: { style: "NONE" }, bottom: b, left: b, right: b, innerVertical: b } });
          }
          if (st.bottom) requests.push({ updateBorders: { range: range(row, row + n, c0, c1), bottom: { style: st.bottom.style, color: rgb(st.bottom.color) } } });
        }
      }
    }
  }
  if (structural.length) await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: structural } });
  await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
  await fitTextRows(c, id, fitRows, ROW_STYLE.text.px);
  if (autoRows.length) await c.sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: autoRows } });
}

/**
 * Pengaman --patch: template diedit user secara visual, jadi posisi baris bisa bergeser. Cek teks penanda di sel yang
 * diharapkan dulu; kalau tidak cocok, berhenti sebelum menulis apa pun (supaya tidak menimpa sel yang salah).
 */
export async function assertAnchors(c: ReportClients, id: string, anchors: Record<string, string>) {
  const ranges = Object.keys(anchors);
  const r = await c.sheets.spreadsheets.values.batchGet({ spreadsheetId: id, ranges });
  const bad = ranges.filter((a, i) => (r.data.valueRanges?.[i]?.values?.[0]?.[0] ?? "").trim() !== anchors[a]);
  if (bad.length)
    throw new Error(
      `Template layout changed, patch aborted. Adjust the positions in the script:\n${bad.map((a) => `  ${a}: expected "${anchors[a]}", found "${r.data.valueRanges?.[ranges.indexOf(a)]?.values?.[0]?.[0] ?? ""}"`).join("\n")}`,
    );
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

/**
 * Sisip baris "In review" di tabel kategori Executive Summary, tepat sebelum baris Unpublished (`unpublishedRow`,
 * posisi sebelum disisip). Sekali saja: kalau baris Unpublished sudah turun satu, dilewati. Baris sisipan ada di dalam
 * rentang pie chart kategori → rentangnya ikut melebar. Merge nama (H:I) & porsi (K:L) dipasang seperti baris lain.
 */
export async function ensureReviewRow(c: ReportClients, id: string, sheet: string, unpublishedRow: number) {
  const q = `'${sheet.replace(/'/g, "''")}'`;
  const r = await c.sheets.spreadsheets.values.batchGet({ spreadsheetId: id, ranges: [`${q}!H${unpublishedRow}`, `${q}!H${unpublishedRow + 1}`] });
  const [at, next] = (r.data.valueRanges ?? []).map((v) => String(v.values?.[0]?.[0] ?? "").trim());
  if (next === "Unpublished" && (at === "In review" || at === "")) return;
  if (at !== "Unpublished" || next !== "Monthly Quota")
    throw new Error(`Template layout changed, In review row not inserted: ${sheet}!H${unpublishedRow} = "${at}", H${unpublishedRow + 1} = "${next}".`);
  const meta = await c.sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets(properties(sheetId,title))" });
  const sheetId = meta.data.sheets!.find((s) => s.properties!.title === sheet)!.properties!.sheetId!;
  const row0 = unpublishedRow - 1;
  const merge = (c0: number, c1: number) => ({ mergeCells: { range: { sheetId, startRowIndex: row0, endRowIndex: row0 + 1, startColumnIndex: c0, endColumnIndex: c1 }, mergeType: "MERGE_ALL" } });
  await c.sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [{ insertDimension: { range: { sheetId, dimension: "ROWS", startIndex: row0, endIndex: row0 + 1 }, inheritFromBefore: true } }, merge(7, 9), merge(10, 12)],
    },
  });
}
