// Google Drive/Sheets untuk laporan. Hanya menulis ke file buatan app (scope drive.file) — file user tidak disentuh:
// file sumber (laporan contoh / template) hanya dibaca & disalin.
import { google, type sheets_v4 } from "googleapis";
import { authorizedClient, DRIVE_FILE_SCOPE, grantedScopes } from "@/modules/connectors/sources/google-oauth";
import type { Tone } from "../types";
import { fitTextRows, ROW_STYLE } from "./template-tools";
import type { Plan, SheetGrid } from "./tokens";
import { isRetryableGoogleError } from "@/modules/connectors/sources/google-errors";

export class ReportError extends Error {}

/** Kuota Drive/Sheets per menit ("User rate limit exceeded", 403/429) → coba ulang dengan jeda 2–32 dtk. */
const isRateLimit = (e: unknown) => isRetryableGoogleError(e) || /rate ?limit|quota/i.test(String((e as Error)?.message ?? e));
export async function gcall<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let delay = 2000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isRateLimit(e)) throw e;
      await new Promise((r) => setTimeout(r, delay + Math.random() * 500));
      delay *= 2;
    }
  }
}

export async function reportClients() {
  const auth = await authorizedClient("sheets");
  if (!auth) throw new ReportError("No Google account connected. Connect one in Settings → Connectors → Google Sheets.");
  if (!(await grantedScopes("sheets")).includes(DRIVE_FILE_SCOPE))
    throw new ReportError("The Google account hasn't granted permission to create report files. Reconnect Google Sheets in Settings → Connectors and tick every permission.");
  return { auth: auth.client, drive: google.drive({ version: "v3", auth: auth.client as never }), sheets: google.sheets({ version: "v4", auth: auth.client as never }) };
}
export type ReportClients = Awaited<ReturnType<typeof reportClients>>;

/** Salin file → file baru milik app (di folder tujuan, default folder sumber). File sumber tidak diubah. */
export async function copyFile(c: ReportClients, sourceId: string, name: string, folderId?: string): Promise<{ id: string; url: string }> {
  const src = await gcall(() => c.drive.files.get({ fileId: sourceId, fields: "parents" }));
  const parents = folderId ? [folderId] : (src.data.parents ?? undefined);
  const res = await gcall(() => c.drive.files.copy({ fileId: sourceId, requestBody: { name, parents }, fields: "id,webViewLink" }));
  return { id: res.data.id!, url: res.data.webViewLink ?? `https://docs.google.com/spreadsheets/d/${res.data.id}/edit` };
}

/**
 * Format laporan sama dengan dashboard: teks English, angka/tanggal gaya Indonesia (1.353,5 · 88,3%) dan zona WIB.
 * Master template sudah di-set in_ID (21 Okt 2026); tetap di-set ulang pada salinan supaya aman jika template diganti.
 * Sheets API menerima "in_ID" untuk Indonesia (id_ID / en_ID ditolak).
 */
export async function setIndonesianLocale(c: ReportClients, spreadsheetId: string) {
  await gcall(() =>
    c.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ updateSpreadsheetProperties: { properties: { locale: "in_ID", timeZone: "Asia/Jakarta" }, fields: "locale,timeZone" } }] },
    }),
  );
}

/** Rename — hanya dipakai untuk file buatan app (drive.file menolak file lain). */
export async function renameFile(c: ReportClients, fileId: string, name: string) {
  await gcall(() => c.drive.files.update({ fileId, requestBody: { name } }));
}

const cellText = (v: sheets_v4.Schema$CellData | undefined): string => {
  const u = v?.userEnteredValue;
  if (!u) return "";
  return u.stringValue ?? u.formulaValue ?? (u.numberValue != null ? String(u.numberValue) : u.boolValue != null ? String(u.boolValue) : "");
};

/** Isi sel (nilai yang diketik) + merge semua sheet. */
export async function readGrids(c: ReportClients, spreadsheetId: string): Promise<SheetGrid[]> {
  const res = await gcall(() => c.sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: true,
    fields: "sheets(properties(sheetId,title,hidden),merges,data(rowData(values(userEnteredValue))))",
  }));
  return (res.data.sheets ?? []).map((s) => ({
    sheetId: s.properties!.sheetId!,
    title: s.properties!.title!,
    hidden: !!s.properties!.hidden,
    rows: (s.data?.[0]?.rowData ?? []).map((r) => (r.values ?? []).map(cellText)),
    merges: (s.merges ?? []).map((m) => ({ startRow: m.startRowIndex!, endRow: m.endRowIndex!, startCol: m.startColumnIndex!, endCol: m.endColumnIndex! })),
  }));
}

const TONE_COLORS: Record<Tone, { fg: string; bg: string }> = {
  good: { fg: "#0B7A0B", bg: "#E6F4E6" },
  bad: { fg: "#B42318", bg: "#FDECEA" },
  flat: { fg: "#5F6368", bg: "#F1F3F4" },
  none: { fg: "#5F6368", bg: "#FFFFFF" },
};
const rgb = (hex: string) => ({ red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 });
const colName = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
const quote = (t: string) => `'${t.replace(/'/g, "''")}'`;

/** Jalankan rencana: sisip baris (format baris contoh) → merge → tulis nilai (RAW: angka tetap angka) → warna tone. */
export async function applyPlan(c: ReportClients, spreadsheetId: string, plan: Plan, grids: SheetGrid[]) {
  const structural: sheets_v4.Schema$Request[] = [];
  for (const i of plan.inserts) {
    structural.push({ insertDimension: { range: { sheetId: i.sheetId, dimension: "ROWS", startIndex: i.at, endIndex: i.at + i.count }, inheritFromBefore: true } });
    // insertDimension hanya mewarisi sebagian format → salin format baris contoh (tinggi baris, border, angka)
    structural.push({
      copyPaste: {
        source: { sheetId: i.sheetId, startRowIndex: i.at - 1, endRowIndex: i.at },
        destination: { sheetId: i.sheetId, startRowIndex: i.at, endRowIndex: i.at + i.count },
        pasteType: "PASTE_FORMAT",
      },
    });
  }
  for (const m of plan.merges)
    structural.push({ mergeCells: { range: { sheetId: m.sheetId, startRowIndex: m.startRow, endRowIndex: m.endRow, startColumnIndex: m.startCol, endColumnIndex: m.endCol }, mergeType: "MERGE_ALL" } });
  if (structural.length) await gcall(() => c.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: structural } }));

  for (let i = 0; i < plan.writes.length; i += 500) {
    const chunk = plan.writes.slice(i, i + 500);
    await gcall(() => c.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: chunk.map((w) => ({ range: `${quote(w.sheetTitle)}!${colName(w.col)}${w.row + 1}`, values: [[w.value ?? ""]] })) },
    }));
  }

  const sheetIds = new Map(grids.map((g) => [g.title, g.sheetId]));
  const toneReqs = plan.writes
    .filter((w) => w.tone)
    .map((w) => ({
      repeatCell: {
        range: { sheetId: sheetIds.get(w.sheetTitle)!, startRowIndex: w.row, endRowIndex: w.row + 1, startColumnIndex: w.col, endColumnIndex: w.col + 1 },
        cell: { userEnteredFormat: { backgroundColor: rgb(TONE_COLORS[w.tone!].bg), textFormat: { foregroundColor: rgb(TONE_COLORS[w.tone!].fg) } } },
        fields: "userEnteredFormat(backgroundColor,textFormat.foregroundColor)",
      },
    }));
  if (toneReqs.length) await gcall(() => c.sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: toneReqs } }));

  if (plan.hidden.length)
    await gcall(() =>
      c.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: plan.hidden.map((h) => ({
            updateDimensionProperties: { range: { sheetId: h.sheetId, dimension: "ROWS", startIndex: h.row, endIndex: h.row + 1 }, properties: { hiddenByUser: true }, fields: "hiddenByUser" },
          })),
        },
      }),
    );

  if (plan.openEnd.length)
    await gcall(() =>
      c.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: plan.openEnd.map((o) => ({
            updateBorders: { range: { sheetId: o.sheetId, startRowIndex: o.row, endRowIndex: o.row + 1, startColumnIndex: 0, endColumnIndex: o.endCol }, bottom: { style: "NONE" } },
          })),
        },
      }),
    );

  // tabel berteks panjang: tinggi sesuai isi, minimal tinggi baris data standar (ROW_STYLE.row)
  const fit = plan.autoHeight.flatMap((r) => Array.from({ length: r.endRow - r.startRow }, (_, k) => ({ sheetId: r.sheetId, row: r.startRow + k })));
  await gcall(() => fitTextRows(c, spreadsheetId, fit, ROW_STYLE.row.px));
}
