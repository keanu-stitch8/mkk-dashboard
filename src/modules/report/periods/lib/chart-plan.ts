import type { sheets_v4 } from "googleapis";
import { monthLabel } from "@/modules/shared/lib/month";
import { PERIOD_CHARTS } from "./slide-plan";
import type { PeriodReportData } from "../types/period-report";

const column = (index: number): string => {
  let result = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
};

export interface PeriodChartPlan {
  clearRanges: string[];
  values: sheets_v4.Schema$ValueRange[];
  requests: sheets_v4.Schema$Request[];
  chartIds: Record<"followers" | "types" | "output", number>;
}

/** Reuse the copied workbook's chart geometry and colours, replacing only its data domains and values. */
export function planPeriodCharts(workbook: sheets_v4.Schema$Spreadsheet, d: PeriodReportData): PeriodChartPlan {
  const plan: PeriodChartPlan = { clearRanges: [], values: [], requests: [], chartIds: { followers: 0, types: 0, output: 0 } };
  for (const role of PERIOD_CHARTS) {
    const sheet = workbook.sheets?.find((s) => s.charts?.some((c) => c.spec?.title === role.title));
    const chart = sheet?.charts?.find((c) => c.spec?.title === role.title);
    if (sheet?.properties?.sheetId == null || !sheet.properties.title || chart?.chartId == null || !chart.spec?.basicChart) throw new Error(`The chart template is missing its ${role.kind} chart.`);
    const spec = structuredClone(chart.spec);
    const basic = spec.basicChart!;
    const domain = basic.domains?.[0]?.domain?.sourceRange?.sources;
    const series = basic.series ?? [];
    const definitions = role.kind === "followers"
      ? [{ name: "Followers", values: d.months.map((m) => m.followers.followers) }]
      : role.kind === "types"
        ? (["carousel", "reels", "story", "other"] as const).map((key, i) => ({ name: ["Carousel", "Reels", "Story", "Photo / other"][i], values: d.months.map((m) => m.viewsByType[key]) }))
        : [
            { name: "Stories", values: d.months.map((m) => m.stories) },
            { name: "Feed + Reels + video", values: d.months.map((m) => m.feedAndReels) },
            { name: "Quota", values: d.months.map((m) => m.quota) },
          ];
    if (domain?.length !== 1 || series.length !== definitions.length) throw new Error(`The ${role.kind} chart layout has changed. Update the chart template first.`);
    const sources = [domain[0], ...series.map((s) => {
      const ranges = s.series?.sourceRange?.sources;
      if (ranges?.length !== 1) throw new Error("Chart series must each use one column in the copied workbook.");
      return ranges[0];
    })];
    const quoted = `'${sheet.properties.title.replace(/'/g, "''")}'`;
    sources.forEach((range, i) => {
      const start = range.startColumnIndex ?? 0;
      if (range.endColumnIndex !== start + 1 || (range.sheetId ?? sheet.properties!.sheetId) !== sheet.properties!.sheetId) throw new Error("Chart data must use single columns on its own sheet.");
      plan.clearRanges.push(`${quoted}!${column(start)}1:${column(start)}${Math.max(7, range.endRowIndex ?? 0)}`);
      plan.values.push({
        range: `${quoted}!${column(start)}1:${column(start)}5`,
        values: i === 0 ? [["Month"], ...d.months.map((m) => [monthLabel(m.month, true)])] : [[definitions[i - 1].name], ...definitions[i - 1].values.map((value) => [value ?? ""])],
      });
      range.sheetId = sheet.properties!.sheetId;
      range.startRowIndex = 0;
      range.endRowIndex = 5;
    });
    basic.headerCount = 1;
    plan.requests.push({ updateChartSpec: { chartId: chart.chartId, spec } });
    plan.chartIds[role.kind] = chart.chartId;
  }
  return plan;
}
