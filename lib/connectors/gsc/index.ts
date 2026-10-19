// Connector Google Search Console — googleapis searchconsole v1 (searchanalytics.query).
// Auth sama dengan GA4: service account atau OAuth akun Google (izin terpisah per connector).
import { google, type searchconsole_v1 } from "googleapis";
import type { Connector, ConnectorStatus, TestResult } from "../types";
import { ConnectorError } from "../types";
import { monthRange, serviceAccountKey, withRetry } from "../common";
import { googleErrorMessage, isRetryableGoogleError } from "../google-errors";
import { GOOGLE_SCOPES, oauthAccount, oauthClientConfigured } from "../google-oauth";
import { hasServiceAccount, resolveGoogleAuth, type AuthInfo } from "../google-auth";
import { mapGscMonth, type GscMonthResponses, type GscResponse } from "./map";

/** Jumlah baris query & halaman yang ditarik per bulan. */
export const GSC_TOP_ROWS = 1000;
/** Data Search Console baru lengkap ±2–3 hari setelah tanggalnya. */
const GSC_DELAY_DAYS = 3;

const rawSite = () => process.env.GSC_SITE_URL?.trim() ?? "";

async function client(): Promise<{ sc: searchconsole_v1.Searchconsole; info: AuthInfo }> {
  const { auth, info } = await resolveGoogleAuth("gsc", GOOGLE_SCOPES.gsc, "Search Console");
  return { sc: google.searchconsole({ version: "v1", auth }), info };
}

function translate(e: unknown, info?: AuthInfo, siteUrl?: string): ConnectorError {
  if (e instanceof ConnectorError) return e;
  return new ConnectorError(googleErrorMessage(e, { api: "gsc", authMode: info?.mode, account: info?.account, siteUrl: siteUrl ?? rawSite() }), String((e as Error)?.message ?? e));
}

/** Properti yang bisa diakses akun ini. */
async function listSites(sc: searchconsole_v1.Searchconsole): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const { data } = await withRetry(() => sc.sites.list(), isRetryableGoogleError);
  return (data.siteEntry ?? []).map((s) => ({ siteUrl: s.siteUrl ?? "", permissionLevel: s.permissionLevel ?? "" })).filter((s) => s.siteUrl);
}

/** GSC_SITE_URL → siteUrl persis. Nama polos (mainkekudus.com) dicocokkan ke daftar properti. */
async function resolveSite(sc: searchconsole_v1.Searchconsole): Promise<string> {
  const raw = rawSite();
  if (!raw) throw new ConnectorError("GSC_SITE_URL belum diisi di .env.local (mis. sc-domain:mainkekudus.com atau https://mainkekudus.com/).");
  const sites = await listSites(sc);
  const usable = sites.filter((s) => s.permissionLevel !== "siteUnverifiedUser");
  const host = raw.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const candidates = /^(sc-domain:|https?:\/\/)/.test(raw) ? [raw, raw.endsWith("/") ? raw : `${raw}/`] : [`sc-domain:${host}`, `https://${host}/`, `https://www.${host}/`, `http://${host}/`];
  const found = candidates.find((c) => usable.some((s) => s.siteUrl === c));
  if (found) return found;
  const list = usable.map((s) => s.siteUrl).join(", ") || "tidak ada";
  throw new ConnectorError(`Properti Search Console "${raw}" tidak bisa diakses akun ini. Properti yang tersedia: ${list}.`);
}

/** Rentang bulan dipotong sesuai delay GSC. */
function gscRange(month: string, now = new Date()) {
  const { start, end } = monthRange(month, now);
  const latest = new Date(now.getTime() + 7 * 3600_000 - GSC_DELAY_DAYS * 86400_000).toISOString().slice(0, 10);
  if (start > latest) throw new ConnectorError(`Data Search Console untuk ${month} belum tersedia (data GSC terlambat ±${GSC_DELAY_DAYS} hari).`);
  return end > latest ? { start, end: latest, partial: true } : { start, end, partial: false };
}

export const gsc: Connector = {
  id: "gsc",
  env: [
    { name: "GSC_SITE_URL", required: true, hint: "Properti Search Console, mis. sc-domain:mainkekudus.com atau https://mainkekudus.com/." },
    { name: "GOOGLE_APPLICATION_CREDENTIALS", required: false, hint: "Opsi 1 — service account (harus ditambahkan sebagai user di Search Console)." },
    { name: "GOOGLE_OAUTH_CLIENT_ID", required: false, hint: "Opsi 2 — login akun Google kamu (OAuth client yang sama dengan GA4)." },
  ],

  async status(): Promise<ConnectorStatus> {
    const missing = this.env.filter((v) => v.required && !process.env[v.name]?.trim()).map((v) => v.name);
    const oauth = { ...(await oauthAccount("gsc")), available: oauthClientConfigured() };
    try {
      if (hasServiceAccount()) return { configured: !missing.length, missing, account: `Service account ${serviceAccountKey().clientEmail}`, oauth };
      if (oauth.connected) return { configured: !missing.length, missing, account: `Akun Google ${oauth.account ?? ""}`.trim(), oauth };
      return { configured: false, missing, account: oauth.available ? "Klik “Hubungkan akun Google” (izin Search Console terpisah dari GA4)." : "Isi GOOGLE_APPLICATION_CREDENTIALS atau GOOGLE_OAUTH_CLIENT_ID/SECRET.", oauth };
    } catch (e) {
      return { configured: false, missing, account: (e as Error).message, oauth };
    }
  },

  async testConnection(): Promise<TestResult> {
    let info: AuthInfo | undefined;
    let siteUrl: string | undefined;
    try {
      const c = await client();
      info = c.info;
      siteUrl = await resolveSite(c.sc);
      const now = new Date();
      const end = new Date(now.getTime() + 7 * 3600_000 - GSC_DELAY_DAYS * 86400_000).toISOString().slice(0, 10);
      const start = new Date(Date.parse(end) - 6 * 86400_000).toISOString().slice(0, 10);
      const { data } = await withRetry(() => c.sc.searchanalytics.query({ siteUrl, requestBody: { startDate: start, endDate: end, type: "web" } }), isRetryableGoogleError);
      const row = data.rows?.[0];
      const via = info.mode === "oauth" ? `akun Google ${info.account ?? ""}`.trim() : `service account ${info.account}`;
      return {
        ok: true,
        message: `Terhubung ke ${siteUrl} lewat ${via}. 7 hari (${start} s/d ${end}): ${Number(row?.clicks ?? 0).toLocaleString("id-ID")} klik, ${Number(row?.impressions ?? 0).toLocaleString("id-ID")} impressions.`,
      };
    } catch (e) {
      return { ok: false, message: translate(e, info, siteUrl).message };
    }
  },

  async fetchMonth(month: string) {
    const { sc, info } = await client();
    let siteUrl: string | undefined;
    try {
      siteUrl = await resolveSite(sc);
      const { start, end, partial } = gscRange(month);
      const q = (dimensions: string[], rowLimit?: number): Promise<GscResponse> =>
        withRetry(
          () => sc.searchanalytics.query({ siteUrl, requestBody: { startDate: start, endDate: end, type: "web", dimensions, ...(rowLimit ? { rowLimit } : {}) } }),
          isRetryableGoogleError,
        ).then((r) => r.data);
      // berurutan supaya ramah kuota per detik GSC
      const res: GscMonthResponses = {
        totals: await q([]),
        queries: await q(["query"], GSC_TOP_ROWS),
        pages: await q(["page"], GSC_TOP_ROWS),
        dates: await q(["date"]),
        devices: await q(["device"]),
        countries: await q(["country"]),
      };
      const via = info.mode === "oauth" ? `akun ${info.account ?? "Google"}` : "service account";
      const datasets = mapGscMonth(res, month, `API Search Console · ${siteUrl} · ${via} · ${start} s/d ${end}`);
      if (partial) for (const d of datasets) d.warnings.push(`Data GSC baru tersedia sampai ${end} (terlambat ±${GSC_DELAY_DAYS} hari) — sync ulang setelah awal bulan depan.`);
      return datasets;
    } catch (e) {
      throw translate(e, info, siteUrl);
    }
  },
};
