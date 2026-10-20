// Seri produksi YouTube (syuting sekali, dipublish bertahap beberapa bulan). Video recap BUKAN bagian seri: diambil
// videografer kontributor lokal Kudus (diedit tim Bogor), tapi tetap dihitung ke KPI/kuota bulanan.
// Seri baru (mis. Q4) → tambahkan entri di sini.

export interface ProductionSeries {
  name: string;
  /** periode syuting, teks laporan */
  shootPeriod: string;
  /** jumlah video landscape hasil produksi seri */
  produced: number;
  /** bulan publish pertama & terakhir (YYYY-MM) */
  from: string;
  to: string;
}

export const YOUTUBE_SERIES: ProductionSeries[] = [{ name: "Q3 2026", shootPeriod: "5–10 Jun 2026", produced: 13, from: "2026-07", to: "2026-09" }];

/** Judul berisi "recap" → produksi terpisah (bukan seri). */
export const isRecap = (title: string) => /recap/i.test(title);

export const seriesFor = (month: string, list = YOUTUBE_SERIES) => list.find((s) => month >= s.from && month <= s.to) ?? null;

/** Progres seri sampai bulan laporan: video seri (non-recap) yang dipublish sebelum bulan ini, di bulan ini, dan sisanya. */
export function seriesProgress(series: ProductionSeries, month: string, published: { month: string; title: string }[]) {
  const own = published.filter((v) => !isRecap(v.title) && v.month >= series.from && v.month <= month);
  const before = own.filter((v) => v.month < month).length;
  const thisMonth = own.length - before;
  return { before, thisMonth, remaining: Math.max(series.produced - before - thisMonth, 0) };
}
