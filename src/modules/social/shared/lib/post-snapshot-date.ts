import { cutoffDate } from "@/modules/shared/lib/month";

/** Reporting follows the monthly lock cut-off, shared by Social and period reports. */
export const socialPostSnapshotDate = (month: string): string => cutoffDate(month);
