// Parser export Google Search Console (XLSX satu file berisi banyak sheet, atau CSV per tabel).
import { findHeader, getCell, type HeaderMatch } from "./headers";
import { dataRows, dominantMonth, makeDataset, monthFromRange } from "./common";
import type { Dataset, DatasetKey, RawTable } from "./types";
import { normalizePath, parseCount, parseDate, parseNumber, parseRate, str } from "./values";

export const GSC_FIELDS = {
  query: ["Top queries", "Query", "Queries", "Kueri teratas", "Kueri", "Kueri penelusuran"],
  page: ["Top pages", "Page", "Pages", "Halaman teratas", "Halaman"],
  date: ["Date", "Tanggal"],
  country: ["Country", "Negara"],
  device: ["Device", "Perangkat"],
  clicks: ["Clicks", "Klik"],
  impressions: ["Impressions", "Tayangan", "Impresi"],
  ctr: ["CTR", "Rasio klik", "Click through rate"],
  position: ["Position", "Posisi", "Average position", "Posisi rata-rata"],
} as const;

type F = keyof typeof GSC_FIELDS;

function metricRow(r: unknown[], m: HeaderMatch<F>) {
  const clicks = parseCount(getCell(r as never, m, "clicks")) ?? 0;
  const impressions = parseCount(getCell(r as never, m, "impressions")) ?? 0;
  const ctr = parseRate(getCell(r as never, m, "ctr"), "auto") ?? (impressions ? clicks / impressions : 0);
  const position = parseNumber(getCell(r as never, m, "position")) ?? 0;
  return { clicks, impressions, ctr, position };
}

export function detectGsc(table: RawTable): Dataset[] | null {
  const kinds: [F, DatasetKey][] = [
    ["query", "gsc_queries"],
    ["page", "gsc_pages"],
    ["date", "gsc_dates"],
    ["device", "gsc_devices"],
    ["country", "gsc_countries"],
  ];
  for (const [dim, key] of kinds) {
    const m = findHeader<F>(table.rows, GSC_FIELDS, [dim, "clicks", "impressions"], 5);
    if (!m) continue;
    // "Date, Clicks, Impressions" juga bisa muncul di file lain; GSC selalu punya CTR atau Position
    if (m.columns.ctr === undefined && m.columns.position === undefined) continue;
    const warnings: string[] = [];
    const month = monthFromRange(table, warnings);
    const rows = dataRows(table, m);
    if (key === "gsc_queries") {
      return [makeDataset(key, table, m, { month, warnings, rows: rows.map((r) => ({ query: str(getCell(r, m, "query")), ...metricRow(r, m) })) })];
    }
    if (key === "gsc_pages") {
      return [
        makeDataset(key, table, m, {
          month,
          warnings,
          rows: rows.map((r) => {
            const url = str(getCell(r, m, "page"));
            return { url, path: normalizePath(url) ?? url, ...metricRow(r, m) };
          }),
        }),
      ];
    }
    if (key === "gsc_dates") {
      const out = rows
        .map((r) => ({ date: parseDate(getCell(r, m, "date"))?.date ?? null, ...metricRow(r, m) }))
        .filter((r) => r.date)
        .map((r) => ({ ...r, _date: r.date }));
      return [makeDataset(key, table, m, { month: month ?? dominantMonth(out), warnings, rows: out, rowDated: true })];
    }
    const dimension = key === "gsc_devices" ? "device" : "country";
    const breakdowns = rows.flatMap((r) => {
      const label = str(getCell(r, m, dim));
      const v = metricRow(r, m);
      return (["clicks", "impressions"] as const).map((metric) => ({ channel: "website" as const, dimension, label, metric, value: v[metric] }));
    });
    return [makeDataset(key, table, m, { month, warnings, breakdowns })];
  }
  return null;
}
