import "server-only";
import { REPORT_CHANNELS } from "@/lib/reports/channels";
import { templateId } from "@/lib/reports/engine/generate";
import { buildReportRows } from "../lib/report-rows";
import { findGeneratedReports, findMonthLock } from "../repositories/report-repository";

/** Status laporan Google Sheets per channel + kunci bulan. */
export async function getReportJobs(month: string) {
  const [generated, lock] = await Promise.all([findGeneratedReports(month), findMonthLock(month)]);
  return { locked: !!lock, reportRows: buildReportRows(REPORT_CHANNELS, templateId, generated) };
}
