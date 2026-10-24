import "server-only";
import { cache } from "react";
import { pickMonth } from "../lib/month-param";
import { getMonthsWithData } from "../services/month-service";
import type { MonthContext } from "../types/month";

/** Bulan yang ditampilkan + daftar bulan; header dan konten halaman yang sama berbagi satu query. */
export const resolveMonth = cache(async (param: string | undefined): Promise<MonthContext> => {
  return pickMonth(param, await getMonthsWithData(), new Date().toISOString());
});
