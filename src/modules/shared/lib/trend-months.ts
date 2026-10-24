import { LAUNCH_MONTH, lastMonths, prevMonth } from "@/modules/shared/lib/month";

/** Bulan grafik tren: n bulan terakhir, dipotong di bulan launching. */
export const trendMonths = (month: string, n = 6) => lastMonths(month, n).filter((m) => m >= LAUNCH_MONTH);

/** Bulan yang dibutuhkan halaman channel: tren + bulan lalu (pembanding MoM), tanpa duplikat. */
export const channelPageMonths = (month: string) => [...new Set([...trendMonths(month), month, prevMonth(month)])];
