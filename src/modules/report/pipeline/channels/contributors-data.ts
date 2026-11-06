import type { ContributorsData, ContributorRecap } from "@/modules/team/contributors/types/contributors";
import { CONTENT_TARGET } from "@/modules/team/contributors/lib/contributors-page";
import { daysInMonth, prevMonth } from "@/modules/shared/lib/month";
import { kpiData, type KpiDef } from "../kpi";
import { enMonth } from "../month";
import type { ReportData } from "../types";
import { n, pct } from "./narrative-utils";
import { sheetDate } from "./news";

/** Delivery follows the Master Report. Media KPIs count stories, never individual files. */
export function contributorKpis(data: ContributorsData) {
  const { items } = data;
  const delivered = items.filter((i) => i.content).length;
  const media = ["portrait", "video", "interview"] as const;
  // An entirely blank group is untracked, rather than a measured zero.
  const available = (keys: readonly (typeof media)[number][]) =>
    items.some((i) => keys.some((k) => i.assets[k].state !== null))
      ? items.filter((i) => keys.some((k) => i.assets[k].state === "available")).length
      : null;
  return {
    delivered,
    achievement: delivered / CONTENT_TARGET,
    remaining: Math.max(CONTENT_TARGET - delivered, 0),
    extra: items.filter((i) => i.content && i.extra).length,
    portrait: available(["portrait"]),
    video: available(["video"]),
    interview: available(["interview"]),
    footage: available(media),
  };
}

export const CONTRIBUTOR_KPIS: KpiDef<ReturnType<typeof contributorKpis>>[] = [
  { key: "delivered", label: "Delivered vs quota", kind: "count", get: (s) => s.delivered, display: (s) => `${s.delivered} / ${CONTENT_TARGET}` },
  { key: "achievement", label: "Quota achievement", kind: "rate", get: (s) => s.achievement },
  { key: "remaining", label: "Remaining quota", kind: "count", goodWhenUp: false, get: (s) => s.remaining },
  { key: "extra", label: "Extra content delivered", kind: "count", get: (s) => s.extra },
  { key: "portrait", label: "Stories with portrait photos", kind: "count", get: (s) => s.portrait },
  { key: "video", label: "Stories with portrait video", kind: "count", get: (s) => s.video },
  { key: "interview", label: "Stories with interview video", kind: "count", get: (s) => s.interview },
  { key: "footage", label: "Stories with footage available", kind: "count", get: (s) => s.footage },
];

export function contributorReportData(month: string, cur: ContributorsData, prev: ContributorsData | null, recap: ContributorRecap): ReportData {
  const metrics = contributorKpis(cur);
  const previous = prev?.items.length ? contributorKpis(prev) : null;
  const kpi = kpiData(CONTRIBUTOR_KPIS, metrics, previous);
  for (const key of ["portrait", "video", "interview", "footage"] as const) {
    if (metrics[key] !== null) continue;
    kpi.values[`kpi.${key}.value`] = "Not tracked";
    kpi.values[`kpi.${key}.change`] = "No media status recorded";
    kpi.tones[`kpi.${key}.change`] = "none";
  }
  const findings = [
    `${n(metrics.delivered)} of ${CONTENT_TARGET} planned items were delivered in ${enMonth(month)}, reaching ${pct(metrics.achievement)} of the monthly quota. ${metrics.remaining ? `${n(metrics.remaining)} more needed to meet the target.` : "The monthly target was met."}`,
    ...(previous ? [`Delivery ${metrics.delivered === previous.delivered ? "was unchanged" : metrics.delivered > previous.delivered ? "rose" : "fell"} from ${n(previous.delivered)} in ${enMonth(prevMonth(month))} to ${n(metrics.delivered)} this month.`] : []),
    `Extra Posts contributed ${n(metrics.extra)} of the ${n(metrics.delivered)} delivered items.`,
  ];
  const history = recap.months.filter((m) => m.month <= month).sort((a, b) => a.month.localeCompare(b.month));
  const mediaStatus = (state: "available" | "missing" | null) => state === "available" ? "Available" : state === "missing" ? "N/A" : "—";
  return {
    values: {
      month_label: enMonth(month),
      month_upper: enMonth(month).toUpperCase(),
      prev_month_label: enMonth(prevMonth(month)),
      period: `1–${daysInMonth(month).length} ${enMonth(month)}`,
      ...kpi.values,
      quota: CONTENT_TARGET,
      delivered: metrics.delivered,
      achievement: metrics.achievement,
      remaining: metrics.remaining,
    },
    tones: kpi.tones,
    autoHeight: ["findings", "log"],
    tables: {
      findings: findings.map((text) => ({ text })),
      log: cur.items.map((item, index) => ({
        no: index + 1,
        planned: sheetDate(item.planned),
        title: `${item.title}${item.extra ? " (Extra Post)" : ""}`,
        status: item.status ? item.status.replace(/\b\w/g, (c) => c.toUpperCase()) : "Waiting",
        submitted: sheetDate(item.articleAt) ?? "—",
        portrait: mediaStatus(item.assets.portrait.state),
        video: mediaStatus(item.assets.video.state),
        interview: mediaStatus(item.assets.interview.state),
      })),
      recap: history.map((m) => ({
        month: enMonth(m.month),
        delivered: m.delivered,
        quota: CONTENT_TARGET,
        achievement: m.delivered / CONTENT_TARGET,
        remaining: Math.max(CONTENT_TARGET - m.delivered, 0),
      })),
    },
  };
}
