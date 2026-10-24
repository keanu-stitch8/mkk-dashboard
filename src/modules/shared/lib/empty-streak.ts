import { daysInMonth } from "@/lib/month";

export interface EmptyStreak {
  length: number;
  from: string | null;
  to: string | null;
}

/** Rangkaian hari kosong berturut-turut terpanjang dalam bulan (hanya sampai hari ini jika bulan berjalan). */
export function longestEmptyStreak(month: string, activeDates: Set<string>, today = new Date().toISOString().slice(0, 10)): EmptyStreak {
  const days = daysInMonth(month).filter((d) => d <= today);
  let best: EmptyStreak = { length: 0, from: null, to: null };
  let run = 0;
  let start: string | null = null;
  for (const d of days) {
    if (activeDates.has(d)) {
      run = 0;
      start = null;
      continue;
    }
    run++;
    start ??= d;
    if (run > best.length) best = { length: run, from: start, to: d };
  }
  return best;
}
