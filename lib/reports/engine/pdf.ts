// Export laporan Google Sheets → satu PDF A4 landscape. Endpoint export Sheets mendukung parameter tata letak
// (ukuran, orientasi, skala) yang tidak tersedia di Drive files.export, tapi skalanya berlaku untuk semua sheet.
// Karena itu tiap sheet di-export sendiri (default pas lebar; opsional sheet tertentu 1 halaman) lalu digabung.
// Supaya tiap halaman penuh kiri–kanan, lebar kolom template disamakan (lib/reports/engine/template-tools.ts → PAGE_WIDTH_PX).
import { Readable } from "node:stream";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { gcall, type ReportClients } from "./sheets";

/**
 * fit "width" = lebar dipaskan (tabel panjang lanjut ke halaman berikut); "page" = seluruh sheet di 1 halaman.
 * rows/cols = hanya rentang itu (0-based, akhir eksklusif) — dipakai untuk memotong sheet di penanda {{pagebreak}}.
 */
export function pdfExportUrl(spreadsheetId: string, opts: { gid?: number; fit?: "width" | "page"; rows?: [number, number]; cols?: number } = {}): string {
  const params = new URLSearchParams({
    format: "pdf",
    size: "A4",
    portrait: "false", // landscape
    scale: opts.fit === "page" ? "4" : "2", // 2 = fit to width, 4 = fit to page
    gridlines: "false",
    sheetnames: "false",
    printtitle: "false",
    pagenum: "UNDEFINED", // nomor halaman ditambahkan setelah digabung (Google menomori per sheet)
    fzr: "true", // ulangi baris header beku di tiap halaman
    top_margin: "0.4",
    bottom_margin: "0.4",
    left_margin: "0.4",
    right_margin: "0.4",
    horizontal_alignment: "CENTER",
  });
  if (opts.gid != null) params.set("gid", String(opts.gid));
  if (opts.rows) {
    params.set("r1", String(opts.rows[0]));
    params.set("r2", String(opts.rows[1]));
    params.set("c1", "0");
    params.set("c2", String(opts.cols ?? 26));
  }
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${params}`;
}

async function fetchPdf(c: ReportClients, url: string): Promise<Buffer> {
  const { token } = await c.auth.getAccessToken();
  return gcall(async () => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const type = res.headers.get("content-type") ?? "";
    // 429 = terlalu banyak export dalam waktu singkat → gcall mencoba ulang dengan jeda
    if (!res.ok || !type.includes("pdf")) throw new Error(`Export PDF gagal (${res.status}${res.status === 429 ? " rate limit" : ""} ${type})`);
    return Buffer.from(await res.arrayBuffer());
  });
}

/** Lebar sheet dalam kolom (sel berisi terakhir / merge) — batas kanan export per rentang. */
const sheetCols = (s: { rows?: string[][]; merges?: { endCol: number }[] }) =>
  Math.max(1, ...(s.rows ?? []).map((r) => r.length), ...(s.merges ?? []).map((m) => m.endCol));

/**
 * Satu PDF berisi semua sheet (urut sesuai workbook). Sheet di `onePage` dipaskan ke satu halaman.
 * `breaks` (dari penanda {{pagebreak}}) memotong sheet: tiap potongan di-export sendiri sehingga mulai di halaman baru.
 * Nomor halaman "n / total" ditambahkan setelah digabung.
 */
export async function exportPdf(
  c: ReportClients,
  spreadsheetId: string,
  sheets: { sheetId: number; title: string; rows?: string[][]; merges?: { endCol: number }[] }[],
  onePage: string[] = [],
  breaks: { sheetId: number; row: number }[] = [],
): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const s of sheets) {
    const fit = onePage.includes(s.title) ? "page" : "width";
    const cuts = breaks.filter((b) => b.sheetId === s.sheetId && b.row > 0).map((b) => b.row).sort((a, b) => a - b);
    const parts = cuts.length ? [0, ...cuts].map((from, i) => ({ rows: [from, cuts[i] ?? 100_000] as [number, number], cols: sheetCols(s) })) : [{}];
    for (const range of parts) {
      const part = await PDFDocument.load(await fetchPdf(c, pdfExportUrl(spreadsheetId, { gid: s.sheetId, fit, ...range })));
      for (const page of await merged.copyPages(part, part.getPageIndices())) merged.addPage(page);
      await new Promise((r) => setTimeout(r, 800)); // ramah kuota export
    }
  }
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const pages = merged.getPages();
  pages.forEach((page, i) => {
    const text = `${i + 1} / ${pages.length}`;
    const size = 8;
    page.drawText(text, { x: (page.getWidth() - font.widthOfTextAtSize(text, size)) / 2, y: 14, size, font, color: rgb(0.45, 0.47, 0.5) });
  });
  return Buffer.from(await merged.save());
}

/** Simpan PDF sebagai file baru di Drive (folder yang sama dengan laporan). */
export async function uploadPdf(c: ReportClients, name: string, pdf: Buffer, parents?: string[]): Promise<{ id: string; url: string }> {
  const res = await gcall(() =>
    c.drive.files.create({
      requestBody: { name, mimeType: "application/pdf", parents },
      media: { mimeType: "application/pdf", body: Readable.from(pdf) },
      fields: "id,webViewLink",
    }),
  );
  return { id: res.data.id!, url: res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view` };
}
