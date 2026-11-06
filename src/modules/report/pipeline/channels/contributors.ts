import { getContributorRecap, getContributors } from "@/modules/team/contributors/services/contributor-service";
import { prevMonth } from "@/modules/shared/lib/month";
import { ReportError } from "../engine/sheets";
import type { ReportChannel, ReportData } from "../types";
import { contributorReportData } from "./contributors-data";

export async function buildContributorReport(month: string): Promise<ReportData> {
  const [cur, prev, recap] = await Promise.all([getContributors(month), getContributors(prevMonth(month)), getContributorRecap()]);
  if (!cur.items.length) throw new ReportError(`No Local Contributor data for ${month}. Fill in the monthly tracker and sync Google Drive before generating the report.`);
  return contributorReportData(month, cur, prev, recap);
}

export const contributors: ReportChannel = {
  id: "contributors",
  title: "Local Contributor",
  templateEnv: "REPORT_TEMPLATE_CONTRIBUTORS",
  build: buildContributorReport,
};
