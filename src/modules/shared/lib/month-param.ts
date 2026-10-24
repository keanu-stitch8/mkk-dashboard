import type { MonthContext } from "../types/month";

/** Nilai pertama query string (`?m=a&m=b` → "a"). */
export const firstParam = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Bulan dari query string, atau bulan terakhir yang ada datanya (bulan berjalan kalau DB kosong). */
export function pickMonth(param: string | undefined, months: string[], today: string): MonthContext {
  if (param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param)) return { month: param, months };
  return { month: months.at(-1) ?? today.slice(0, 7), months };
}
