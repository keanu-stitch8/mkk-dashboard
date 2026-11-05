import { addMonths, daysInMonth, monthLabel } from "@/modules/shared/lib/month";
import type { ReportPeriod } from "../types/period-report";
import { socialPostSnapshotDate } from "@/modules/social/shared/lib/post-snapshot-date";

export const PERIOD_START = "2026-07";
export const PERIOD_MONTHS = 4;

/** Period post metrics follow the same cut-off as the closing month's lock. */
export const periodPostSnapshotDate = (period: ReportPeriod): string => socialPostSnapshotDate(period.endMonth);

export function reportPeriod(number: number): ReportPeriod {
  if (!Number.isSafeInteger(number) || number < 1 || number > 1200) throw new Error("Choose a valid report period.");
  const startMonth = addMonths(PERIOD_START, (number - 1) * PERIOD_MONTHS);
  const months = Array.from({ length: PERIOD_MONTHS }, (_, i) => addMonths(startMonth, i));
  const endMonth = months.at(-1)!;
  const startDate = `${startMonth}-01`;
  const endDate = daysInMonth(endMonth).at(-1)!;
  const range = (short: boolean) => {
    const name = (m: string) => monthLabel(m).split(" ")[0];
    const a = short ? name(startMonth).slice(0, 3) : name(startMonth);
    const b = short ? name(endMonth).slice(0, 3) : name(endMonth);
    return startMonth.slice(0, 4) === endMonth.slice(0, 4)
      ? `${a} to ${b} ${endMonth.slice(0, 4)}`
      : `${a} ${startMonth.slice(0, 4)} to ${b} ${endMonth.slice(0, 4)}`;
  };
  return {
    number, months, startMonth, endMonth, startDate, endDate,
    days: Math.round((Date.parse(endDate) - Date.parse(startDate)) / 864e5) + 1,
    rangeLabel: range(false), shortRangeLabel: range(true), label: `Period ${number} (${range(false)})`,
  };
}

export function periodAt(date: string): number {
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  return Math.max(1, Math.floor(((year - 2026) * 12 + month - 7) / PERIOD_MONTHS) + 1);
}

export function defaultPeriod(today: string): number {
  const current = periodAt(today);
  return reportPeriod(current).endDate < today ? current : Math.max(1, current - 1);
}

export function periodParam(value: string | undefined, today: string): number {
  const n = value && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n >= 1 && n <= periodAt(today) ? n : defaultPeriod(today);
}

export const PERIOD_REPORT_TITLE = "Instagram Four-Month Performance Report";
export const periodReportName = (p: ReportPeriod) => `MKK ${PERIOD_REPORT_TITLE}, Period ${p.number} (${p.shortRangeLabel})`;
export const periodDate = (date: string, short = false) => {
  const [year, , day] = date.split("-");
  const name = monthLabel(date.slice(0, 7)).split(" ")[0];
  return `${Number(day)} ${short ? name.slice(0, 3) : name} ${year}`;
};
