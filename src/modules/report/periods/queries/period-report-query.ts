import "server-only";
import { cache } from "react";
import { DRIVE_FILE_SCOPE, grantedScopes } from "@/modules/connectors/sources/google-oauth";
import { dateIn, WIB } from "@/modules/shared/lib/tz";
import { periodAt, periodParam, reportPeriod } from "../lib/period";
import { findPeriodReports } from "../repositories/period-report-repository";
import { getPeriodReportData } from "../services/period-data-service";
import { periodReportConfig } from "../services/period-report-config";
import type { PeriodReportPage } from "../types/period-report";

export const getPeriodReportPage = cache(async (param: string | undefined): Promise<PeriodReportPage> => {
  const today = dateIn(Date.now(), WIB);
  const number = periodParam(param, today);
  const period = reportPeriod(number);
  const [data, runs, scopes] = await Promise.all([getPeriodReportData(number), findPeriodReports(period.endMonth), grantedScopes("sheets")]);
  return {
    data,
    periods: Array.from({ length: periodAt(today) }, (_, i) => reportPeriod(i + 1)).reverse().map((p) => ({ number: p.number, label: p.label, complete: p.endDate < today })),
    jobs: runs.map(({ createdAt, ...r }) => ({ ...r, createdAt: createdAt.toISOString() })),
    googleConnected: scopes.includes(DRIVE_FILE_SCOPE),
    templateUrl: `https://docs.google.com/presentation/d/${periodReportConfig().slidesTemplateId}/edit`,
  };
});
