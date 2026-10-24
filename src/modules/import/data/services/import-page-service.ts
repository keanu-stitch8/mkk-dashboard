import "server-only";
import { configuredConnectors } from "@/modules/connectors/sources";
import { currentMonth } from "@/modules/shared/lib/month";
import { findAllManualMetrics } from "@/modules/shared/repositories/manual-metric-repository";
import { findDefaultQuotaRows } from "@/modules/shared/repositories/quota-repository";
import { getQuotas } from "@/modules/shared/services/quota-service";
import { buildQuotaRows, groupManualValues } from "../lib/import-page";
import type { ImportPage } from "../types/import-page";

export async function getImportPage(month: string): Promise<ImportPage> {
  const [manualRows, quotas, defaults, configured] = await Promise.all([findAllManualMetrics(month), getQuotas(month), findDefaultQuotaRows(), configuredConnectors()]);
  return { month, manual: groupManualValues(manualRows), quotaRows: buildQuotaRows(quotas, defaults), configured, currentMonth: currentMonth() };
}
