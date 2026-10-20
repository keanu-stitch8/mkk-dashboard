// Connector Google Sheets — Publishing Log bulanan dari Google Drive (OAuth akun Google, scope drive.readonly).
// File dicari otomatis per nama + bulan (lihat map.ts), di-export ke XLSX lewat Drive API, lalu diparse dengan
// parser yang sama seperti upload XLSX — hasilnya identik dengan import manual.
import { google, type drive_v3 } from "googleapis";
import type { Dataset } from "../../parsers/types";
import { parseFiles } from "../../parsers";
import { readTrackerTab, socialReviewDataset } from "../../parsers/logs";
import { readYtCalendarGantt, readYtCalendarSummary, ytCalendarLogDataset, ytReviewDataset } from "../../parsers/youtube-calendar";
import { readTables } from "../../parsers/tabular";
import { prevMonth } from "../../month";
import type { Connector, ConnectorStatus, TestResult } from "../types";
import { ConnectorError } from "../types";
import { monthRange, withRetry } from "../common";
import { googleErrorMessage, isRetryableGoogleError } from "../google-errors";
import { GOOGLE_SCOPES, oauthAccount, oauthClientConfigured } from "../google-oauth";
import { resolveGoogleAuth, type AuthInfo } from "../google-auth";
import { LOG_FILES, TRACKER_FILES, pickLogFile, pickTrackerFile, type DriveFile, type LogKind, type TrackerKind } from "./map";

const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const KINDS = Object.keys(LOG_FILES) as LogKind[];

const retry = <T>(fn: () => Promise<T>) => withRetry(fn, isRetryableGoogleError);

async function client(): Promise<{ drive: drive_v3.Drive; info: AuthInfo }> {
  const { auth, info } = await resolveGoogleAuth("sheets", GOOGLE_SCOPES.sheets, "Google Sheets");
  return { drive: google.drive({ version: "v3", auth: auth as never }), info };
}

function translate(e: unknown, info?: AuthInfo): ConnectorError {
  if (e instanceof ConnectorError) return e;
  return new ConnectorError(googleErrorMessage(e, { api: "sheets", authMode: info?.mode, account: info?.account }), String((e as Error)?.message ?? e));
}

/** Semua spreadsheet yang bisa dibuka akun ini (milik sendiri + dibagikan), lalu dicocokkan namanya di map.ts. */
async function listSpreadsheets(drive: drive_v3.Drive): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const { data } = await retry(() =>
      drive.files.list({
        q: `mimeType='${SHEET_MIME}' and trashed=false`,
        fields: "nextPageToken, files(id,name,modifiedTime)",
        pageSize: 1000,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageToken,
      }),
    );
    for (const f of data.files ?? []) if (f.id && f.name) out.push({ id: f.id, name: f.name.trim(), modifiedTime: f.modifiedTime ?? undefined });
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }
  return out;
}

async function exportXlsx(drive: drive_v3.Drive, id: string): Promise<Uint8Array> {
  const res = await retry(() => drive.files.export({ fileId: id, mimeType: XLSX_MIME }, { responseType: "arraybuffer" }));
  return new Uint8Array(res.data as ArrayBuffer);
}

/** Ambil & parse satu log. null + peringatan jika file tidak ada / tab log tidak terbaca. */
async function fetchLog(drive: drive_v3.Drive, files: DriveFile[], kind: LogKind, month: string, warnings: string[]): Promise<Dataset | null> {
  const spec = LOG_FILES[kind];
  const { file, others } = pickLogFile(files, kind, month);
  if (!file) {
    warnings.push(`${spec.label} ${month}: file tidak ditemukan di Google Drive (dicari nama berisi “${spec.label}” + bulan, mis. “September 2026”).`);
    return null;
  }
  if (others.length) warnings.push(`${spec.label}: ada ${others.length + 1} file untuk bulan ini — dipakai “${file.name}” (terakhir diubah).`);
  const result = parseFiles([{ name: `${file.name}.xlsx`, data: await exportXlsx(drive, file.id) }], spec.group);
  const ds = result.datasets.find((d) => d.key === spec.key);
  if (!ds) {
    const why = result.skipped.map((s) => `${s.sheet ?? s.file}: ${s.reason}`).join("; ");
    warnings.push(`${spec.label}: “${file.name}” ditemukan, tapi tab log tidak terbaca${why ? ` (${why})` : ""}.`);
    return null;
  }
  ds.file = `Google Sheets · ${file.name}`;
  ds.url = sheetUrl(file);
  return ds;
}

const sheetUrl = (f: DriveFile) => `https://docs.google.com/spreadsheets/d/${f.id}/edit`;

/** File tracker (satu file untuk semua bulan) → tabel mentah. null + peringatan jika file tidak ada. */
async function trackerTables(drive: drive_v3.Drive, files: DriveFile[], kind: TrackerKind, warnings: string[]) {
  const file = pickTrackerFile(files, kind);
  if (!file) {
    warnings.push(`${TRACKER_FILES[kind].label}: file tidak ditemukan di Google Drive — data dari file ini tidak diperbarui.`);
    return null;
  }
  const { tables } = readTables({ name: `${file.name}.xlsx`, data: await exportXlsx(drive, file.id) });
  return { file, tables, label: `Google Sheets · ${file.name}` };
}

/** In review sosmed bulan ini dari Task Progress. */
async function fetchSocialTracker(drive: drive_v3.Drive, files: DriveFile[], month: string, warnings: string[]): Promise<Dataset[]> {
  const t = await trackerTables(drive, files, "social", warnings);
  if (!t) return [];
  // semua tab: konten tab bulan lalu bisa saja baru disubmit bulan ini
  const tabs = t.tables.map(readTrackerTab).filter((x) => !!x);
  if (!tabs.some((x) => x.tabMonth === month)) {
    warnings.push(`${TRACKER_FILES.social.label}: tidak ada tab dengan Planned Date ${month} di “${t.file.name}” — sosmed in review tidak diperbarui.`);
    return [];
  }
  return [{ ...socialReviewDataset(tabs.flatMap((x) => x.rows), month, t.label), url: sheetUrl(t.file) }];
}

/** Log YouTube (tab Summary) + in review (tab Tracker/Gantt) bulan ini dari Calendar Timeline. */
async function fetchYoutubeCalendar(drive: drive_v3.Drive, files: DriveFile[], month: string, warnings: string[]): Promise<Dataset[]> {
  const t = await trackerTables(drive, files, "youtube", warnings);
  if (!t) return [];
  const out: Dataset[] = [];
  const summary = t.tables.map(readYtCalendarSummary).find((x) => !!x);
  if (summary) out.push({ ...ytCalendarLogDataset(summary, month, t.label), url: sheetUrl(t.file) });
  else warnings.push(`${TRACKER_FILES.youtube.label}: tab Summary (Publish Date, Video, Status) tidak terbaca di “${t.file.name}”.`);
  const gantt = t.tables.map(readYtCalendarGantt).find((x) => !!x);
  if (gantt) out.push({ ...ytReviewDataset(gantt, month, t.label), url: sheetUrl(t.file) });
  else warnings.push(`${TRACKER_FILES.youtube.label}: tab Tracker (Gantt) tidak terbaca di “${t.file.name}” — YouTube in review tidak diperbarui.`);
  return out;
}

export const sheets: Connector = {
  id: "sheets",
  env: [
    { name: "GOOGLE_OAUTH_CLIENT_ID", required: true, hint: "OAuth client (sama dengan GA4/GSC/YouTube); aktifkan juga Google Drive API." },
    { name: "GOOGLE_OAUTH_CLIENT_SECRET", required: true, hint: "Secret OAuth client." },
  ],

  async status(): Promise<ConnectorStatus> {
    const missing = this.env.filter((v) => v.required && !process.env[v.name]?.trim()).map((v) => v.name);
    const oauth = { ...(await oauthAccount("sheets")), available: oauthClientConfigured() };
    if (oauth.connected) return { configured: !missing.length, missing, account: `Akun Google ${oauth.account ?? ""}`.trim(), oauth };
    return { configured: false, missing, account: "Klik “Hubungkan akun Google” dan login dengan akun yang bisa membuka spreadsheet log.", oauth };
  },

  async testConnection(): Promise<TestResult> {
    let info: AuthInfo | undefined;
    try {
      const c = await client();
      info = c.info;
      const files = await listSpreadsheets(c.drive);
      const now = new Date();
      const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const lines = [cur, prevMonth(cur)].map((m) => {
        const found = KINDS.map((k) => `${LOG_FILES[k].label} ${pickLogFile(files, k, m).file ? "✓" : "✗"}`);
        return `${m}: ${found.join(", ")}`;
      });
      for (const k of Object.keys(TRACKER_FILES) as TrackerKind[]) lines.push(`${TRACKER_FILES[k].label} ${pickTrackerFile(files, k) ? "✓" : "✗"}`);
      return { ok: true, message: `Terhubung sebagai ${info.account ?? "akun Google"} (${files.length} spreadsheet bisa diakses). ${lines.join(" · ")}.` };
    } catch (e) {
      return { ok: false, message: translate(e, info).message };
    }
  },

  async fetchMonth(month: string) {
    monthRange(month); // validasi format & tolak bulan yang belum dimulai
    const { drive, info } = await client();
    try {
      const files = await listSpreadsheets(drive);
      const warnings: string[] = [];
      const datasets: Dataset[] = [];
      for (const kind of KINDS) {
        const ds = await fetchLog(drive, files, kind, month, warnings);
        if (ds) datasets.push(ds);
      }
      datasets.push(...(await fetchSocialTracker(drive, files, month, warnings)));
      datasets.push(...(await fetchYoutubeCalendar(drive, files, month, warnings)));
      if (!datasets.length) throw new ConnectorError(`Tidak ada Publishing Log ${month} yang bisa dibaca. ${warnings.join(" ")}`);
      for (const d of datasets) d.warnings.push(...warnings);
      return datasets;
    } catch (e) {
      throw translate(e, info);
    }
  },
};
