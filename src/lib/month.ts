// Helper bulan "YYYY-MM".

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function isMonth(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split("-").map(Number);
  const name = MONTH_NAMES[m - 1] ?? month;
  return short ? `${name.slice(0, 3)} ${String(y).slice(2)}` : `${name} ${y}`;
}

/** Bulan launching; grafik tren tidak menampilkan bulan sebelumnya. */
export const LAUNCH_MONTH = "2026-06";

/**
 * Tanggal potong data bulanan (mulai Oktober 2026): tanggal 5 bulan berikutnya — cron sync + kunci + laporan, dan
 * metrik lifetime per post IG diambil per tanggal ini walau sync terlambat (lib/connectors/meta applyCutoffSnapshot).
 */
export const CUTOFF_DAY = 5;
export const cutoffDate = (month: string) => `${addMonths(month, 1)}-${String(CUTOFF_DAY).padStart(2, "0")}`;

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const prevMonth = (month: string) => addMonths(month, -1);

/** n bulan terakhir berakhir di `month` (urut lama → baru). */
export function lastMonths(month: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(month, i - n + 1));
}

export function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
