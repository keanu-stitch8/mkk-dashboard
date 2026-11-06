import { describe, expect, it } from "vitest";
import { buildContributorRecap, buildContributors } from "@/modules/team/contributors/lib/contributors";
import type { ContributorTaskEntry } from "@/modules/team/contributors/types/contributors";
import { contributorKpis, contributorReportData } from "./contributors-data";
import { contributorTemplatePlan, CONTRIBUTOR_SHEETS } from "../engine/contributor-template";
import { planFill, type SheetGrid } from "../engine/tokens";

const refs = [{ alias: "A", name: "Writer A", role: "Journalist" }, { alias: "B", name: "Writer B", role: "Journalist" }, { alias: "Y", name: "Camera", role: "Footage" }];
const row = (overrides: Partial<ContributorTaskEntry> = {}): ContributorTaskEntry => ({
  id: "one", tab: "2026-10", no: 1, n: 1, planned: "2026-10-01", title: "A story", guideFile: null, status: "submitted", articleBy: "A", articleAt: "2026-10-02", storyCode: null, extra: false,
  landscape: null, landscapeBy: null, landscapeAt: null,
  portrait: null, portraitBy: null, portraitAt: null,
  video: null, videoBy: null, videoAt: null,
  interview: null, interviewBy: null, interviewAt: null,
  ...overrides,
});

describe("Local Contributor monthly report", () => {
  it("counts submitted and extra content once and exposes a delivery log without contributor names", () => {
    const rows = [row({ articleBy: "A, B, Y", video: "available", videoBy: "Y", portrait: "available", portraitBy: "Y" }), row({ id: "extra", extra: true }), row({ id: "draft", status: "draft" })];
    const cur = buildContributors(rows, refs, []);
    const report = contributorReportData("2026-10", cur, null, buildContributorRecap(rows, refs));
    expect(report.values["kpi.delivered.value"]).toBe("2 / 60");
    expect(report.values["kpi.achievement.value"]).toBe(2 / 60);
    expect(report.values["kpi.extra.value"]).toBe(1);
    expect(report.values["kpi.footage.value"]).toBe(1); // two media types on one story
    expect(Object.keys(report.tables)).toEqual(["findings", "log", "recap"]);
    expect(report.tables.log).toHaveLength(3);
    expect(report.tables.log[0]).toMatchObject({ no: 1, title: "A story", status: "Submitted", portrait: "Available", video: "Available", interview: "—" });
    expect(report.tables.log[1].title).toBe("A story (Extra Post)");
    expect(report.tables.log[2].status).toBe("Draft");
    expect(JSON.stringify(report)).not.toMatch(/Writer A|Writer B|Camera|Journalist|articleBy|videoBy|credit|assignee/i);
  });

  it("ignores landscape availability, distinguishes untracked from unavailable, and does not require media for delivery", () => {
    const cur = buildContributors([row({ landscape: "available", interview: "missing" })], refs, []);
    expect(contributorKpis(cur)).toMatchObject({ delivered: 1, portrait: null, video: null, interview: 0, footage: 0 });
    const landscapeOnly = buildContributors([row({ landscape: "available" })], refs, []);
    expect(contributorKpis(landscapeOnly).footage).toBeNull();
    const report = contributorReportData("2026-10", landscapeOnly, cur, buildContributorRecap([row()], refs));
    expect(report.values["kpi.footage.value"]).toBe("Not tracked");
    expect(report.values["kpi.footage.change"]).toBe("No media status recorded");
  });

  it("omits future months and compares with the previous month independently of writer assignments", () => {
    const prevRows = [row({ tab: "2026-09" })];
    const rows = [row(), row({ id: "two", articleBy: null })];
    const all = [...prevRows, ...rows, row({ tab: "2026-11" })];
    const data = contributorReportData("2026-10", buildContributors(rows, refs, []), buildContributors(prevRows, refs, []), buildContributorRecap(all, refs));
    expect(data.values["kpi.delivered.change"]).toBe("↑ +100,0% vs last month");
    expect(data.tones?.["kpi.remaining.change"]).toBe("good");
    expect(data.tables.recap.map((r) => r.month)).toEqual(["September 2026", "October 2026"]);
    const noPrev = contributorReportData("2026-10", buildContributors(rows, refs, []), buildContributors([], refs, []), buildContributorRecap(all, refs));
    expect(noPrev.values["kpi.delivered.change"]).toBe("No data last month");
  });

  it("fills every template placeholder and excludes assignees, asset totals and landscape notes", () => {
    const plan = contributorTemplatePlan([{ properties: { sheetId: 123, title: CONTRIBUTOR_SHEETS[0], gridProperties: { rowCount: 61 } } }]);
    const grids: SheetGrid[] = CONTRIBUTOR_SHEETS.map((title, sheetId) => ({ title, sheetId, rows: [], merges: [] }));
    for (const v of plan.data) {
      const match = v.range!.match(/^'(.+)'!([A-Z])(\d+)$/)!;
      const grid = grids.find((g) => g.title === match[1])!;
      const r = Number(match[3]) - 1;
      (grid.rows[r] ??= [])[match[2].charCodeAt(0) - 65] = String(v.values![0][0]);
    }
    // Model blank cells as readGrids does.
    grids.forEach((g) => { g.rows = Array.from({ length: g.rows.length }, (_, i) => Array.from({ length: g.rows[i]?.length ?? 0 }, (_, j) => g.rows[i][j] ?? "")); });
    const rows = [row()];
    const report = contributorReportData("2026-10", buildContributors(rows, refs, []), null, buildContributorRecap(rows, refs));
    expect(planFill(grids, report).warnings).toEqual([]);
    expect(JSON.stringify(plan.data)).not.toMatch(/landscape|total assets|assignee|#contributors\./i);
  });
});
