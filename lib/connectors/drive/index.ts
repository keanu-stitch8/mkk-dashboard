// Connector Google Drive — dokumen kerja tim: panduan liputan harian (→ Story), brief turunan (→ Brief), dan
// status editor dari "Social Media - Task Progress" (→ BriefTask).
// Memakai akun Google yang sama dengan connector Sheets (scope drive.readonly). Tidak mengisi dataset import:
// hasilnya disimpan di tabel Story / Brief lalu dicocokkan dengan artikel & post IG (lib/team/store.ts).
import { google } from "googleapis";
import type { Connector, ConnectorStatus, SyncOutput, TestResult } from "../types";
import { ConnectorError } from "../types";
import { monthRange } from "../common";
import { googleErrorMessage } from "../google-errors";
import { GOOGLE_SCOPES, oauthAccount } from "../google-oauth";
import { resolveGoogleAuth, type AuthInfo } from "../google-auth";
import { rebuildMatches, syncBriefTracker, syncTeamDocs } from "../../team/store";
import { sheets } from "../sheets";

async function client() {
  const { auth, info } = await resolveGoogleAuth("sheets", GOOGLE_SCOPES.sheets, "Google Drive");
  return { drive: google.drive({ version: "v3", auth: auth as never }), info };
}

const translate = (e: unknown, info?: AuthInfo) =>
  e instanceof ConnectorError ? e : new ConnectorError(googleErrorMessage(e, { api: "sheets", authMode: info?.mode, account: info?.account }), String((e as Error)?.message ?? e));

export const drive: Connector = {
  id: "drive",
  env: sheets.env,

  async status(): Promise<ConnectorStatus> {
    const s = await sheets.status();
    const oauth = await oauthAccount("sheets");
    return {
      configured: s.configured,
      missing: s.missing,
      account: oauth.connected ? `Uses the Google account connected to Google Sheets (${oauth.account ?? "connected"})` : "Connect a Google account on the Google Sheets connector first.",
    };
  },

  async testConnection(): Promise<TestResult> {
    let info: AuthInfo | undefined;
    try {
      const c = await client();
      info = c.info;
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prefix = month.slice(2, 4) + month.slice(5, 7);
      const { data } = await c.drive.files.list({ q: `name contains '${prefix}' and trashed = false`, fields: "files(name)", pageSize: 1000 });
      const names = (data.files ?? []).map((f) => f.name ?? "").filter((n) => n.startsWith(prefix));
      const panduan = names.filter((n) => /_\s*PANDUAN LIPUTAN/i.test(n)).length;
      const briefs = names.filter((n) => /_\s*Brief\s/i.test(n)).length;
      return { ok: true, message: `Connected as ${info.account ?? "Google account"}. ${month}: ${panduan} coverage guide(s), ${briefs} brief(s) found.` };
    } catch (e) {
      return { ok: false, message: translate(e, info).message };
    }
  },

  async fetchMonth() {
    return []; // tidak mengisi dataset import; lihat syncMonth
  },

  async syncMonth(month: string): Promise<SyncOutput> {
    monthRange(month);
    const { drive, info } = await client();
    try {
      const r = await syncTeamDocs(drive, month);
      const t = await syncBriefTracker(drive);
      const m = await rebuildMatches();
      const types = Object.entries(r.briefTypes).map(([t, n]) => `${n} ${t}`).join(", ");
      return {
        rows: r.stories + r.briefs,
        detail: [
          `Coverage guides: ${r.panduan} file(s), ${r.stories} planned article(s)`,
          `Briefs: ${r.briefs}${types ? ` (${types})` : ""}`,
          t.file ? `Task Progress (“${t.file}”): ${t.rows} brief row(s)${t.unknown.length ? `, ${t.unknown.length} not among synced briefs (old file names or months not synced yet)` : ""}` : "Task Progress: not found",
          `Matches (all months): ${m.auto} auto, ${m.tracker} confirmed by Task Progress, ${m.suggested} need confirmation`,
          ...[...r.warnings, ...t.warnings].map((w) => `⚠ ${w}`),
        ],
      };
    } catch (e) {
      throw translate(e, info);
    }
  },
};
