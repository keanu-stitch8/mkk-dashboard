// Mapping response Search Console API (searchanalytics.query) → Dataset yang sama dengan hasil import CSV/XLSX GSC.
// Murni (tanpa I/O) supaya bisa dites dengan fixture JSON.
import type { Dataset } from "@/modules/import/parsers/types";
import { normalizePath } from "@/modules/import/parsers/values";
import { apiDataset, num } from "../common";

export interface GscRow {
  keys?: string[] | null;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
}
export interface GscResponse {
  rows?: GscRow[] | null;
}

export interface GscMonthResponses {
  totals: GscResponse;
  queries: GscResponse;
  pages: GscResponse;
  dates: GscResponse;
  devices: GscResponse;
  countries: GscResponse;
}

// ISO 3166-1 alpha-3 (format API) → alpha-2 (untuk nama negara via Intl). Negara di luar daftar tampil sebagai kodenya.
const ALPHA3: Record<string, string> = {
  idn: "ID", mys: "MY", sgp: "SG", tha: "TH", phl: "PH", vnm: "VN", brn: "BN", khm: "KH", lao: "LA", mmr: "MM", tls: "TL",
  usa: "US", can: "CA", mex: "MX", bra: "BR", arg: "AR", chl: "CL", col: "CO", per: "PE",
  gbr: "GB", irl: "IE", fra: "FR", deu: "DE", nld: "NL", bel: "BE", lux: "LU", che: "CH", aut: "AT", ita: "IT", esp: "ES", prt: "PT",
  swe: "SE", nor: "NO", dnk: "DK", fin: "FI", isl: "IS", pol: "PL", cze: "CZ", svk: "SK", hun: "HU", rou: "RO", bgr: "BG", grc: "GR",
  ukr: "UA", rus: "RU", tur: "TR", arm: "AM", geo: "GE", aze: "AZ", kaz: "KZ", uzb: "UZ",
  sau: "SA", are: "AE", qat: "QA", kwt: "KW", omn: "OM", bhr: "BH", jor: "JO", isr: "IL", irn: "IR", irq: "IQ", egy: "EG", mar: "MA",
  ind: "IN", pak: "PK", bgd: "BD", lka: "LK", npl: "NP", chn: "CN", hkg: "HK", twn: "TW", mac: "MO", jpn: "JP", kor: "KR",
  aus: "AU", nzl: "NZ", png: "PG", zaf: "ZA", nga: "NG", ken: "KE", gha: "GH", eth: "ET", tza: "TZ",
};
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "idn" → "Indonesia" (sama dengan label di export GSC). */
export function countryName(code: string): string {
  const a2 = ALPHA3[code.toLowerCase()];
  if (!a2) return code.toUpperCase();
  return regionNames.of(a2) ?? code.toUpperCase();
}

/** "MOBILE" → "Mobile". */
export const deviceName = (d: string) => (d ? d.charAt(0).toUpperCase() + d.slice(1).toLowerCase() : d);

const metrics = (r: GscRow) => ({ clicks: num(r.clicks), impressions: num(r.impressions), ctr: num(r.ctr), position: num(r.position) });
const key0 = (r: GscRow) => r.keys?.[0] ?? "";

export function mapGscMonth(res: GscMonthResponses, month: string, source: string): Dataset[] {
  const ds = (key: Parameters<typeof apiDataset>[0], init: Partial<Dataset>) => apiDataset(key, source, month, init);

  const dates = (res.dates.rows ?? [])
    .map((r) => ({ date: key0(r), ...metrics(r), _date: key0(r) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const total = res.totals.rows?.[0];
  const breakdown = (rows: GscRow[] | null | undefined, dimension: string, label: (k: string) => string) =>
    (rows ?? []).flatMap((r) =>
      (["clicks", "impressions"] as const).map((metric) => ({ channel: "website" as const, dimension, label: label(key0(r)), metric, value: num(r[metric]) })),
    );

  return [
    ds("gsc_queries", { rows: (res.queries.rows ?? []).map((r) => ({ query: key0(r), ...metrics(r) })) }),
    ds("gsc_pages", { rows: (res.pages.rows ?? []).map((r) => ({ url: key0(r), path: normalizePath(key0(r)) ?? key0(r), ...metrics(r) })) }),
    ds("gsc_dates", {
      rows: dates,
      rowDated: true,
      // total resmi properti (posisi rata-rata dari GSC, bukan hitungan ulang dari data harian)
      metrics: total
        ? [
            { channel: "website", key: "gsc_clicks", value: num(total.clicks) },
            { channel: "website", key: "gsc_impressions", value: num(total.impressions) },
            { channel: "website", key: "gsc_ctr", value: num(total.ctr) },
            { channel: "website", key: "gsc_position", value: num(total.position) },
          ]
        : [],
    }),
    ds("gsc_devices", { breakdowns: breakdown(res.devices.rows, "device", deviceName) }),
    ds("gsc_countries", { breakdowns: breakdown(res.countries.rows, "country", countryName) }),
  ];
}
