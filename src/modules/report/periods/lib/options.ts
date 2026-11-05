import { daysInMonth, isMonth } from "@/modules/shared/lib/month";
import { reportPeriod } from "./period";
import type { PeriodReportOptions } from "../types/period-report";

export function parsePeriodRequest(body: unknown): { number: number; options: PeriodReportOptions } {
  if (!body || typeof body !== "object") throw new Error("Choose a report period.");
  const value = body as Record<string, unknown>;
  const number = value.period;
  if (typeof number !== "number") throw new Error("Choose a report period.");
  const period = reportPeriod(number);
  const options: PeriodReportOptions = {};
  if (value.casePostId != null) {
    if (typeof value.casePostId !== "string" || !value.casePostId.trim() || value.casePostId.length > 200) throw new Error("Choose a valid case study.");
    options.casePostId = value.casePostId.trim();
  }
  if (value.organic != null) {
    if (typeof value.organic !== "boolean") throw new Error("Confirm whether the period had no paid promotion.");
    options.organic = value.organic;
  }
  if (value.followerTarget != null || value.targetDate != null) {
    if (typeof value.followerTarget !== "number" || !Number.isSafeInteger(value.followerTarget) || value.followerTarget < 1 || value.followerTarget > 1e9) throw new Error("Enter a positive whole-number follower target.");
    if (typeof value.targetDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.targetDate) || !isMonth(value.targetDate.slice(0, 7)) || !daysInMonth(value.targetDate.slice(0, 7)).includes(value.targetDate)) throw new Error("Choose a valid target date.");
    if (value.targetDate <= period.endDate) throw new Error("The target date must be after the report period ends.");
    options.followerTarget = value.followerTarget;
    options.targetDate = value.targetDate;
  }
  return { number, options };
}
