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
import { PACIFIC, addDays, dateIn } from "../../tz";

/** Jumlah baris query & halaman yang ditarik per bulan. */
export const GSC_TOP_ROWS = 1000;

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
  if (!raw) throw new ConnectorError("GSC_SITE_URL isn't set in .env.local (e.g. sc-domain:mainkekudus.com or https://mainkekudus.com/).");
  const sites = await listSites(sc);
  const usable = sites.filter((s) => s.permissionLevel !== "siteUnverifiedUser");
  const host = raw.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const candidates = /^(sc-domain:|https?:\/\/)/.test(raw) ? [raw, raw.endsWith("/") ? raw : `${raw}/`] : [`sc-domain:${host}`, `https://${host}/`, `https://www.${host}/`, `http://${host}/`];
  const found = candidates.find((c) => usable.some((s) => s.siteUrl === c));
  if (found) return found;
  const list = usable.map((s) => s.siteUrl).join(", ") || "none";
  throw new ConnectorError(`This account can't access the Search Console property "${raw}". Available properties: ${list}.`);
}

/**
 * Tanggal terakhir yang datanya sudah final menurut API: hari sebelum `metadata.firstIncompleteDate`
 * (hanya dikirim untuk dataState "all" + dimensi date bila rentang memuat hari yang belum final).
 * Tanggal GSC = Pacific Time (dokumentasi searchanalytics.query).
 */
async function lastFinalDate(sc: searchconsole_v1.Searchconsole, siteUrl: string, start: string, end: string): Promise<string> {
  const { data } = await withRetry(
    () => sc.searchanalytics.query({ siteUrl, requestBody: { startDate: start, endDate: end, type: "web", dimensions: ["date"], dataState: "all" } }),
    isRetryableGoogleError,
  );
  const firstIncomplete = (data as { metadata?: { firstIncompleteDate?: string } }).metadata?.firstIncompleteDate;
  return firstIncomplete ? addDays(firstIncomplete, -1) : end;
}

/** Rentang bulan (hari Pacific Time) dipotong sampai data final terakhir menurut API. */
async function gscRange(sc: searchconsole_v1.Searchconsole, siteUrl: string, month: string, now = new Date()) {
  const range = monthRange(month, now, PACIFIC);
  const latest = await lastFinalDate(sc, siteUrl, range.start, range.end);
  if (range.start > latest) throw new ConnectorError(`Search Console data for ${month} isn't final yet (first day Google is still processing: ${addDays(latest, 1)}, Pacific Time).`);
  return range.end > latest ? { start: range.start, end: latest, partial: true } : range;
}

export const gsc: Connector = {
  id: "gsc",
  env: [
    { name: "GSC_SITE_URL", required: true, hint: "Search Console property, e.g. sc-domain:mainkekudus.com or https://mainkekudus.com/." },
    { name: "GOOGLE_APPLICATION_CREDENTIALS", required: false, hint: "Option 1 — service account (must be added as a user in Search Console)." },
    { name: "GOOGLE_OAUTH_CLIENT_ID", required: false, hint: "Option 2 — sign in with your Google account (same OAuth client as GA4)." },
  ],

  async status(): Promise<ConnectorStatus> {
    const missing = this.env.filter((v) => v.required && !process.env[v.name]?.trim()).map((v) => v.name);
    const oauth = { ...(await oauthAccount("gsc")), available: oauthClientConfigured() };
    try {
      if (hasServiceAccount()) return { configured: !missing.length, missing, account: `Service account ${serviceAccountKey().clientEmail}`, oauth };
      if (oauth.connected) return { configured: !missing.length, missing, account: `Google account ${oauth.account ?? ""}`.trim(), oauth };
      return { configured: false, missing, account: oauth.available ? "Click “Connect Google account” (Search Console permission is separate from GA4)." : "Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_OAUTH_CLIENT_ID/SECRET.", oauth };
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
      const today = dateIn(new Date(), PACIFIC);
      const end = await lastFinalDate(c.sc, siteUrl, addDays(today, -14), today);
      const start = addDays(end, -6);
      const { data } = await withRetry(() => c.sc.searchanalytics.query({ siteUrl, requestBody: { startDate: start, endDate: end, type: "web" } }), isRetryableGoogleError);
      const row = data.rows?.[0];
      const via = info.mode === "oauth" ? `Google account ${info.account ?? ""}`.trim() : `service account ${info.account}`;
      return {
        ok: true,
        message: `Connected to ${siteUrl} via ${via}. 7 days (${start} to ${end}): ${Number(row?.clicks ?? 0).toLocaleString("en-ID")} clicks, ${Number(row?.impressions ?? 0).toLocaleString("en-ID")} impressions.`,
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
      const { start, end, partial } = await gscRange(sc, siteUrl, month);
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
      const via = info.mode === "oauth" ? `account ${info.account ?? "Google"}` : "service account";
      const datasets = mapGscMonth(res, month, `API Search Console · ${siteUrl} · ${via} · ${start} to ${end} (Pacific Time)`);
      if (partial) for (const d of datasets) d.warnings.push(`Final GSC data only goes through ${end} (Pacific Time; later days are still being processed by Google) — re-sync after the start of next month.`);
      return datasets;
    } catch (e) {
      throw translate(e, info, siteUrl);
    }
  },
};
