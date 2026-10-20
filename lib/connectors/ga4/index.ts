// Connector GA4 — Google Analytics Data API (BetaAnalyticsDataClient).
// Auth: service account (GOOGLE_APPLICATION_CREDENTIALS) ATAU akun Google pengguna lewat OAuth
// (untuk yang punya akses lihat GA4 tapi bukan admin, sehingga tidak bisa menambah service account).
import { BetaAnalyticsDataClient, type protos } from "@google-analytics/data";
import { GoogleAuth } from "google-auth-library";
import type { Connector, ConnectorStatus, TestResult } from "../types";
import { ConnectorError } from "../types";
import { monthRange, serviceAccountKey, withRetry } from "../common";
import { googleErrorMessage, isRetryableGoogleError } from "../google-errors";
import { authorizedClient, oauthAccount, oauthClientConfigured } from "../google-oauth";
import { mapGa4Month, type Ga4MonthReports, type Ga4Report } from "./map";
import { prisma } from "../../db";
import { WIB } from "../../tz";

type RunReportRequest = protos.google.analytics.data.v1beta.IRunReportRequest;
type AuthInfo = { mode: "service_account" | "oauth"; account?: string };

const PAGE_LIMIT = 10000;

function propertyId(): string {
  const id = process.env.GA4_PROPERTY_ID?.trim().replace(/^properties\//, "");
  if (!id) throw new ConnectorError("GA4_PROPERTY_ID belum diisi di .env.local (angka Property ID, mis. 123456789).");
  if (!/^\d+$/.test(id)) {
    throw new ConnectorError(`GA4_PROPERTY_ID harus berupa angka Property ID (GA4 → Admin → Property details), bukan "${id}". Measurement ID G-XXXX bukan Property ID.`);
  }
  return id;
}

const hasServiceAccount = () => !!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

/** Client GA4 + info auth. Service account didahulukan jika diisi; selain itu OAuth akun Google. */
async function resolveClient(): Promise<{ client: BetaAnalyticsDataClient; auth: AuthInfo }> {
  if (hasServiceAccount()) {
    const key = serviceAccountKey();
    return { client: new BetaAnalyticsDataClient({ keyFilename: key.path }), auth: { mode: "service_account", account: key.clientEmail } };
  }
  const oauth = await authorizedClient("ga4");
  if (oauth) {
    return { client: new BetaAnalyticsDataClient({ auth: new GoogleAuth({ authClient: oauth.client }) }), auth: { mode: "oauth", account: oauth.email } };
  }
  throw new ConnectorError("Belum ada kredensial GA4: isi GOOGLE_APPLICATION_CREDENTIALS (service account), atau klik “Hubungkan akun Google” di kartu GA4.");
}

/** runReport dengan pagination (limit/offset) + retry. */
async function runReport(c: BetaAnalyticsDataClient, req: RunReportRequest): Promise<Ga4Report> {
  const all: NonNullable<Ga4Report["rows"]> = [];
  let head: Ga4Report = {};
  for (let offset = 0; ; offset += PAGE_LIMIT) {
    const [res] = await withRetry(() => c.runReport({ ...req, limit: PAGE_LIMIT, offset }), isRetryableGoogleError);
    head = res;
    all.push(...(res.rows ?? []));
    if (!res.rows?.length || all.length >= Number(res.rowCount ?? 0)) break;
  }
  return { dimensionHeaders: head.dimensionHeaders, metricHeaders: head.metricHeaders, rows: all };
}

/** Zona waktu properti GA4 (metadata.timeZone respons API) — rentang tanggal GA4 dievaluasi di zona ini. */
async function propertyTimeZone(c: BetaAnalyticsDataClient): Promise<string> {
  const [res] = await withRetry(
    () => c.runReport({ property: `properties/${propertyId()}`, dateRanges: [{ startDate: "today", endDate: "today" }], metrics: [{ name: "activeUsers" }], limit: 1 }),
    isRetryableGoogleError,
  );
  const tz = res.metadata?.timeZone;
  if (!tz) throw new ConnectorError("Respons GA4 tidak memuat zona waktu properti (metadata.timeZone).");
  return tz;
}

function translate(e: unknown, auth?: AuthInfo): ConnectorError {
  if (e instanceof ConnectorError) return e;
  return new ConnectorError(
    googleErrorMessage(e, { api: "ga4", authMode: auth?.mode, account: auth?.account, propertyId: process.env.GA4_PROPERTY_ID }),
    String((e as Error)?.message ?? e),
  );
}

/**
 * Active users per kota + negara selama bulan itu → tabel Ga4City (laporan: peringkat kota Indonesia saja).
 * Data per periode (stabil); bulan terkunci hanya diisi jika belum ada — data lain tidak disentuh.
 */
export async function saveGa4Cities(month: string, client?: BetaAnalyticsDataClient, timeZone?: string): Promise<number> {
  const { isMonthLocked } = await import("../lock");
  if ((await isMonthLocked(month)) && (await prisma.ga4City.count({ where: { month } }))) return 0;
  const c = client ?? (await resolveClient()).client;
  const { start, end } = monthRange(month, new Date(), timeZone ?? (await propertyTimeZone(c)));
  const res = await runReport(c, {
    property: `properties/${propertyId()}`,
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: [{ name: "city" }, { name: "country" }],
    metrics: [{ name: "activeUsers" }, { name: "newUsers" }],
  });
  // GA4 bisa mengirim kota kosong DAN "(not set)" sebagai baris terpisah (mis. China, Okt 2026) → keduanya
  // menjadi "(not set)", jadi baris dengan kunci sama digabung (kunci tabel = month + city + country)
  const byKey = new Map<string, { month: string; city: string; country: string; activeUsers: number; newUsers: number }>();
  for (const r of res.rows ?? []) {
    const city = r.dimensionValues?.[0]?.value || "(not set)";
    const country = r.dimensionValues?.[1]?.value || "(not set)";
    const row = byKey.get(`${city}\u0000${country}`) ?? { month, city, country, activeUsers: 0, newUsers: 0 };
    row.activeUsers += Number(r.metricValues?.[0]?.value ?? 0);
    row.newUsers += Number(r.metricValues?.[1]?.value ?? 0);
    byKey.set(`${city}\u0000${country}`, row);
  }
  const rows = [...byKey.values()];
  await prisma.$transaction([prisma.ga4City.deleteMany({ where: { month } }), prisma.ga4City.createMany({ data: rows })]);
  return rows.length;
}

export const ga4: Connector = {
  id: "ga4",
  env: [
    { name: "GA4_PROPERTY_ID", required: true, hint: "Property ID GA4 (angka), dari GA4 → Admin → Property details." },
    { name: "GOOGLE_APPLICATION_CREDENTIALS", required: false, hint: "Opsi 1 — path file JSON kunci service account (butuh admin GA4 untuk menambahkannya)." },
    { name: "GOOGLE_OAUTH_CLIENT_ID", required: false, hint: "Opsi 2 — OAuth client (Web application) untuk login akun Google kamu." },
    { name: "GOOGLE_OAUTH_CLIENT_SECRET", required: false, hint: "Opsi 2 — secret OAuth client." },
  ],

  async status(): Promise<ConnectorStatus> {
    const missing = this.env.filter((v) => v.required && !process.env[v.name]?.trim()).map((v) => v.name);
    const oauth = { ...(await oauthAccount("ga4")), available: oauthClientConfigured() };
    try {
      if (hasServiceAccount()) {
        const key = serviceAccountKey();
        return { configured: !missing.length, missing, account: `Service account ${key.clientEmail}`, oauth };
      }
      if (oauth.connected) return { configured: !missing.length, missing, account: `Akun Google ${oauth.account ?? ""}`.trim(), oauth };
      return {
        configured: false,
        missing: missing.length ? missing : [],
        account: oauth.available ? "Klik “Hubungkan akun Google”, atau isi GOOGLE_APPLICATION_CREDENTIALS." : "Isi GOOGLE_APPLICATION_CREDENTIALS (service account) atau GOOGLE_OAUTH_CLIENT_ID/SECRET (login akun Google).",
        oauth,
      };
    } catch (e) {
      return { configured: false, missing, account: (e as Error).message, oauth };
    }
  },

  async testConnection(): Promise<TestResult> {
    let auth: AuthInfo | undefined;
    try {
      const resolved = await resolveClient();
      auth = resolved.auth;
      const property = `properties/${propertyId()}`;
      const [res] = await withRetry(
        () => resolved.client.runReport({ property, dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }], metrics: [{ name: "activeUsers" }] }),
        isRetryableGoogleError,
      );
      const users = Number(res.rows?.[0]?.metricValues?.[0]?.value ?? 0);
      const via = auth.mode === "oauth" ? `akun Google ${auth.account ?? ""}` : `service account ${auth.account}`;
      return { ok: true, message: `Terhubung ke properti ${propertyId()} lewat ${via}. Active users 7 hari terakhir: ${users.toLocaleString("id-ID")}.` };
    } catch (e) {
      return { ok: false, message: translate(e, auth).message };
    }
  },

  async fetchMonth(month: string) {
    const property = `properties/${propertyId()}`;
    const { client: c, auth } = await resolveClient();
    const tz = await propertyTimeZone(c).catch((e) => {
      throw translate(e, auth);
    });
    const { start, end, partial } = monthRange(month, new Date(), tz);
    const base = { property, dateRanges: [{ startDate: start, endDate: end }] };
    const m = (...names: string[]) => names.map((name) => ({ name }));
    const d = (...names: string[]) => names.map((name) => ({ name }));
    const byDesc = (metric: string) => [{ metric: { metricName: metric }, desc: true }];

    try {
      const [totals, channels, pages, pageTitles, landing, firstChannel, city] = await Promise.all([
        runReport(c, { ...base, metrics: m("activeUsers", "newUsers", "sessions", "screenPageViews", "engagementRate", "userEngagementDuration", "bounceRate") }),
        runReport(c, {
          ...base,
          dimensions: d("sessionDefaultChannelGroup"),
          metrics: m("sessions", "engagedSessions", "engagementRate", "userEngagementDuration", "eventCount", "activeUsers", "newUsers"),
          orderBys: byDesc("sessions"),
        }),
        runReport(c, { ...base, dimensions: d("pagePath"), metrics: m("screenPageViews", "activeUsers", "userEngagementDuration", "eventCount"), orderBys: byDesc("screenPageViews") }),
        runReport(c, { ...base, dimensions: d("pagePath", "pageTitle"), metrics: m("screenPageViews"), orderBys: byDesc("screenPageViews") }),
        runReport(c, { ...base, dimensions: d("landingPage"), metrics: m("sessions", "activeUsers", "newUsers", "userEngagementDuration"), orderBys: byDesc("sessions") }),
        runReport(c, { ...base, dimensions: d("firstUserDefaultChannelGroup"), metrics: m("newUsers"), orderBys: byDesc("newUsers") }),
        runReport(c, { ...base, dimensions: d("city"), metrics: m("activeUsers", "newUsers"), orderBys: byDesc("activeUsers") }),
      ]);
      const reports: Ga4MonthReports = { totals, channels, pages, pageTitles, landing, firstChannel, city };
      await saveGa4Cities(month, c, tz);
      const via = auth.mode === "oauth" ? `akun ${auth.account ?? "Google"}` : "service account";
      const datasets = mapGa4Month(reports, month, `API GA4 · properti ${propertyId()} · ${via} · ${start} s/d ${end}`);
      if (partial) for (const ds of datasets) ds.warnings.push(`Bulan berjalan — data sampai ${end}.`);
      if (tz !== WIB) for (const ds of datasets) ds.warnings.push(`Zona waktu properti GA4 = ${tz} (bukan WIB): batas bulan & hari mengikuti zona properti.`);
      return datasets;
    } catch (e) {
      throw translate(e, auth);
    }
  },
};
