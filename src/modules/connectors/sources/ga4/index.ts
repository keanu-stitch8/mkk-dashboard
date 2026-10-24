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
import { cumulativeMetric, mapGa4Month, returningMetric, type Ga4MonthReports, type Ga4Report } from "./map";
import { prisma } from "@/lib/db";
import { WIB } from "@/modules/shared/lib/tz";

type RunReportRequest = protos.google.analytics.data.v1beta.IRunReportRequest;
type AuthInfo = { mode: "service_account" | "oauth"; account?: string };

const PAGE_LIMIT = 10000;

function propertyId(): string {
  const id = process.env.GA4_PROPERTY_ID?.trim().replace(/^properties\//, "");
  if (!id) throw new ConnectorError("GA4_PROPERTY_ID isn't set in .env.local (the numeric Property ID, e.g. 123456789).");
  if (!/^\d+$/.test(id)) {
    throw new ConnectorError(`GA4_PROPERTY_ID must be the numeric Property ID (GA4 → Admin → Property details), not "${id}". A G-XXXX Measurement ID isn't a Property ID.`);
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
  throw new ConnectorError("No GA4 credentials yet: set GOOGLE_APPLICATION_CREDENTIALS (service account), or click “Connect Google account” on the GA4 card.");
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

/** Tanggal paling awal yang diterima GA4 Data API = "sejak awal data" (data properti ini mulai 23 Jun 2026). */
const GA4_EARLIEST = "2015-08-14";

/**
 * Isi metrik audiens (returningUsers, cumulativeUsers) untuk bulan yang sudah di-sync — termasuk bulan terkunci —
 * tanpa menyentuh data lain: ditempel ke import ga4_overview bulan itu. Metrik yang sudah ada dilewati.
 */
export async function saveGa4Audience(month: string): Promise<Record<string, number>> {
  const imp = await prisma.import.findUnique({ where: { month_source: { month, source: "ga4_overview" } }, select: { id: true } });
  if (!imp) return {};
  const have = new Set((await prisma.metric.findMany({ where: { month, channel: "website", key: { in: ["returningUsers", "cumulativeUsers"] } }, select: { key: true } })).map((m) => m.key));
  const { client: c } = await resolveClient();
  const { start, end } = monthRange(month, new Date(), await propertyTimeZone(c));
  const property = `properties/${propertyId()}`;
  const metrics = [
    ...(have.has("returningUsers") ? [] : returningMetric(await runReport(c, { property, dateRanges: [{ startDate: start, endDate: end }], dimensions: [{ name: "newVsReturning" }], metrics: [{ name: "activeUsers" }] }))),
    ...(have.has("cumulativeUsers") ? [] : cumulativeMetric(await runReport(c, { property, dateRanges: [{ startDate: GA4_EARLIEST, endDate: end }], metrics: [{ name: "totalUsers" }] }))),
  ];
  for (const m of metrics) await prisma.metric.create({ data: { importId: imp.id, month, ...m } });
  return Object.fromEntries(metrics.map((m) => [m.key, m.value]));
}

/** Zona waktu properti GA4 (metadata.timeZone respons API) — rentang tanggal GA4 dievaluasi di zona ini. */
async function propertyTimeZone(c: BetaAnalyticsDataClient): Promise<string> {
  const [res] = await withRetry(
    () => c.runReport({ property: `properties/${propertyId()}`, dateRanges: [{ startDate: "today", endDate: "today" }], metrics: [{ name: "activeUsers" }], limit: 1 }),
    isRetryableGoogleError,
  );
  const tz = res.metadata?.timeZone;
  if (!tz) throw new ConnectorError("The GA4 response doesn't include the property time zone (metadata.timeZone).");
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
    { name: "GA4_PROPERTY_ID", required: true, hint: "GA4 Property ID (numeric), from GA4 → Admin → Property details." },
    { name: "GOOGLE_APPLICATION_CREDENTIALS", required: false, hint: "Option 1 — path to the service account JSON key file (a GA4 admin has to add it)." },
    { name: "GOOGLE_OAUTH_CLIENT_ID", required: false, hint: "Option 2 — OAuth client (Web application) for signing in with your Google account." },
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
      if (oauth.connected) return { configured: !missing.length, missing, account: `Google account ${oauth.account ?? ""}`.trim(), oauth };
      return {
        configured: false,
        missing: missing.length ? missing : [],
        account: oauth.available ? "Click “Connect Google account”, or set GOOGLE_APPLICATION_CREDENTIALS." : "Set GOOGLE_APPLICATION_CREDENTIALS (service account) or GOOGLE_OAUTH_CLIENT_ID/SECRET (Google sign-in).",
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
      const via = auth.mode === "oauth" ? `Google account ${auth.account ?? ""}` : `service account ${auth.account}`;
      return { ok: true, message: `Connected to property ${propertyId()} via ${via}. Active users in the last 7 days: ${users.toLocaleString("en-ID")}.` };
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
      const [totals, channels, pages, pageTitles, landing, firstChannel, city, returning, cumulative] = await Promise.all([
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
        runReport(c, { ...base, dimensions: d("newVsReturning"), metrics: m("activeUsers") }),
        runReport(c, { property, dateRanges: [{ startDate: GA4_EARLIEST, endDate: end }], metrics: m("totalUsers") }),
      ]);
      const reports: Ga4MonthReports = { totals, channels, pages, pageTitles, landing, firstChannel, city, returning, cumulative };
      await saveGa4Cities(month, c, tz);
      const via = auth.mode === "oauth" ? `account ${auth.account ?? "Google"}` : "service account";
      const datasets = mapGa4Month(reports, month, `API GA4 · property ${propertyId()} · ${via} · ${start} to ${end}`);
      if (partial) for (const ds of datasets) ds.warnings.push(`Current month — data through ${end}.`);
      if (tz !== WIB) for (const ds of datasets) ds.warnings.push(`GA4 property time zone = ${tz} (not WIB): month & day boundaries follow the property's zone.`);
      return datasets;
    } catch (e) {
      throw translate(e, auth);
    }
  },
};
