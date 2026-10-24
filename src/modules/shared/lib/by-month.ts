import { monthLabel } from "@/lib/month";

/** Ringkasan bulan m dari hasil query; bulan yang tidak dimuat = bug orkestrasi, bukan data kosong. */
export function atMonth<S>(byMonth: Map<string, S>, m: string): S {
  const s = byMonth.get(m);
  if (s === undefined) throw new Error(`Summary for ${m} was not loaded`);
  return s;
}

/** Titik grafik tren (ChartCard butuh `label`). */
export function trendPoints<S, F extends object>(months: string[], byMonth: Map<string, S>, fields: (s: S) => F): ({ month: string; label: string } & F)[] {
  return months.map((m) => ({ month: m, label: monthLabel(m, true), ...fields(atMonth(byMonth, m)) }));
}

/** Muat satu ringkasan per bulan secara paralel. */
export async function loadByMonth<S>(months: string[], load: (m: string) => Promise<S>): Promise<Map<string, S>> {
  const rows = await Promise.all(months.map((m) => load(m)));
  return new Map(months.map((m, i) => [m, rows[i]]));
}
