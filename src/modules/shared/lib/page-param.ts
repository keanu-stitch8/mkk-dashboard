import { firstParam } from "./month-param";

/** ?page=N → nomor halaman (paginate() yang menjepit ke rentang valid). */
export const pageParam = (v: string | string[] | undefined) => Number(firstParam(v) ?? 1);
