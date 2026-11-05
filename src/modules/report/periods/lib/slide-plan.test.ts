import { describe, expect, it } from "vitest";
import type { slides_v1, sheets_v4 } from "googleapis";
import fixture from "../../../../../tests/fixtures/period-report-template.json";
import { buildPeriodData } from "./period-data";
import { reportPeriod } from "./period";
import { monthFixtures } from "./period-test-fixture";
import { PERIOD_CHARTS, planPeriodSlides, slideElements, verifyPeriodSlideText } from "./slide-plan";
import { planPeriodCharts } from "./chart-plan";

/** Apply the relevant Google text/table operations to the text-only native-template fixture. */
function apply(presentation: slides_v1.Schema$Presentation, requests: slides_v1.Schema$Request[]) {
  const elements = slideElements(presentation);
  for (const req of requests) {
    if (req.createShape) {
      const request = req.createShape;
      const shape: slides_v1.Schema$PageElement = { objectId: request.objectId, shape: { text: { textElements: [{ textRun: { content: "\n" } }] } } };
      presentation.slides!.find((slide) => slide.objectId === request.elementProperties!.pageObjectId)!.pageElements!.push(shape);
      elements.set(request.objectId!, shape);
    }
    if (req.deleteTableRow) {
      const table = elements.get(req.deleteTableRow.tableObjectId!)!.table!;
      table.tableRows!.splice(req.deleteTableRow.cellLocation!.rowIndex!, 1); table.rows = table.tableRows!.length;
    }
    if (req.insertTableRows) {
      const request = req.insertTableRows;
      const table = elements.get(request.tableObjectId!)!.table!;
      const rows = Array.from({ length: request.number! }, () => ({ tableCells: Array.from({ length: table.columns! }, () => ({ text: { textElements: [{ textRun: { content: "\n" } }] } })) }));
      table.tableRows!.splice(request.cellLocation!.rowIndex! + 1, 0, ...rows); table.rows = table.tableRows!.length;
    }
    const request = req.insertText ?? req.deleteText;
    if (!request) continue;
    const e = elements.get(request.objectId!)!;
    const cell = request.cellLocation;
    const text = cell ? e.table!.tableRows![cell.rowIndex!]!.tableCells![cell.columnIndex!]!.text! : e.shape!.text!;
    const old = text.textElements!.map((t) => t.textRun?.content ?? "").join("");
    const value = req.insertText
      ? old.slice(0, req.insertText.insertionIndex!) + req.insertText.text! + old.slice(req.insertText.insertionIndex!)
      : old.slice(0, req.deleteText!.textRange!.startIndex!) + old.slice(req.deleteText!.textRange!.endIndex!);
    text.textElements = [{ textRun: { content: value } }];
  }
}

describe("approved 13-slide template contract", () => {
  it("labels the approved post-period snapshot separately from the account reporting window", () => {
    const presentation = structuredClone(fixture) as unknown as slides_v1.Schema$Presentation;
    const months = monthFixtures();
    const snapshot = { mediaId: "post-1", date: "2026-11-02", views: 18432, reach: 12266, likes: 250, comments: 19, shares: 300, saves: 280, follows: null };
    const data = buildPeriodData(reportPeriod(1), months, [snapshot], "2026-11-05", {}, "2026-11-02");
    const plan = planPeriodSlides(presentation, data);
    expect(plan.texts.find((text) => text.objectId === "SLIDES_API620330423_49" && text.row === 0)!.text).toContain("2 Nov 2026");
    expect(plan.texts.find((text) => text.objectId === "ge2ed559f88_0_88")!.text).toBe("18.432");
    expect(plan.texts.find((text) => text.objectId === "period_follows_note")!.text).toContain("after period end");
    const methodology = plan.texts.find((text) => text.objectId === "m_body")!.text;
    expect(methodology).toContain("2 November 2026 snapshot, not 31 October 2026");
    expect(methodology).toContain("July to October 2026");
    apply(presentation, plan.requests);
    expect(() => verifyPeriodSlideText(presentation, plan.texts)).not.toThrow();
  });
  it("replaces period-specific text, table cells and the goal exactly once", () => {
    const presentation = structuredClone(fixture) as unknown as slides_v1.Schema$Presentation;
    const d = buildPeriodData(reportPeriod(2), monthFixtures(2), [], "2027-03-04");
    const plan = planPeriodSlides(presentation, d, { followerTarget: 3000, targetDate: "2027-05-31" });
    const keys = plan.texts.map((t) => `${t.objectId}:${t.row ?? "shape"}:${t.col ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(plan.texts.find((t) => t.objectId === "ge3bf6cbf14_0_365")!.text).toContain("1.600 more needed");
    apply(presentation, plan.requests);
    expect(() => verifyPeriodSlideText(presentation, plan.texts)).not.toThrow();
    const all = JSON.stringify(presentation);
    expect(all).toContain("November 2026 to February 2027");
    expect(plan.texts.find((t) => t.objectId === "gaa3fb9f80e_0_3814")!.text.replaceAll("\v", " ")).toBe("Instagram Four-Month Performance Report");
    expect(all).not.toContain("30 October");
    expect(all).not.toContain("Period 1");
    expect(all).not.toContain("31 Dec");
    expect(all).not.toContain("100% organic");
    expect(plan.texts.every((t) => !/[;:\u2013\u2014]|--/.test(t.text))).toBe(true);
  });
  it("requires explicit organic confirmation and rejects changed template bindings", () => {
    const presentation = structuredClone(fixture) as unknown as slides_v1.Schema$Presentation;
    const d = buildPeriodData(reportPeriod(1), monthFixtures(), [], "2026-11-05");
    expect(planPeriodSlides(presentation, d, { organic: true }).texts.find((t) => t.objectId === "gaa3fb9f80e_0_3810")!.text).toContain("100% organic");
    presentation.slides!.pop();
    expect(() => planPeriodSlides(presentation, d)).toThrow("13 slides");
  });
  it("fills the 13-slide report without a case study and clears stale top-post and case-study values", () => {
    const presentation = structuredClone(fixture) as unknown as slides_v1.Schema$Presentation;
    const months = monthFixtures();
    months[3].posts[0].capturedOn = "2026-11-04";
    const data = buildPeriodData(reportPeriod(1), months, [], "2026-11-05");
    const plan = planPeriodSlides(presentation, data);
    expect(data.blockedReasons).toEqual([]);
    apply(presentation, plan.requests);
    expect(() => verifyPeriodSlideText(presentation, plan.texts)).not.toThrow();
    expect(presentation.slides).toHaveLength(13);
    const elements = slideElements(presentation);
    const content = (id: string) => elements.get(id)!.shape!.text!.textElements!.map((text) => text.textRun?.content ?? "").join("").trim();
    expect(content("ge442786401_0_1301")).toContain("4.000");
    expect(content("SLIDES_API620330423_48")).toBe("Top Content · n/a · Period 1");
    const table = elements.get("SLIDES_API620330423_49")!.table!;
    expect(table.rows).toBe(3);
    expect(table.tableRows![2].tableCells!.map((cell) => cell.text!.textElements!.map((text) => text.textRun?.content ?? "").join("").trim())).toEqual(["n/a", "Month-end views unavailable", "n/a", "n/a", "n/a"]);
    expect(content("ge2ed559f88_0_117")).toBe("Case study · n/a");
    for (const id of ["ge2ed559f88_0_88", "ge2ed559f88_0_84", "ge2ed559f88_0_92", "ge2ed559f88_0_80"]) expect(content(id)).toBe("n/a");
    expect(content("entok_note")).toContain("31 Oct 2026");
    expect(content("m_body")).toContain("case study is unavailable");
  });
  it("labels CSV follows separately from the historical snapshot and keeps the four case-study metrics", () => {
    const presentation = structuredClone(fixture) as unknown as slides_v1.Schema$Presentation;
    const months = monthFixtures();
    months[3].posts[0].follows = null;
    months[3].posts[0].profileVisits = null;
    months[3].posts[0].followsCsv = { postId: "post-1", follows: 278, observedOn: null, importedOn: "2026-11-05" };
    const data = buildPeriodData(reportPeriod(1), months, [], "2026-11-05");
    const plan = planPeriodSlides(presentation, data);
    expect(plan.texts.find((text) => text.objectId === "SLIDES_API620330423_49" && text.row === 2 && text.col === 4)!.text).toBe("278*");
    expect(plan.texts.find((text) => text.objectId === "period_follows_note")!.text).toContain("uploaded 5 Nov 2026, export date unknown");
    expect(plan.texts.find((text) => text.objectId === "ge2ed559f88_0_91")!.text).toBe("Profile visits");
    expect(plan.texts.find((text) => text.objectId === "ge2ed559f88_0_79")!.text).toBe("Follows");
    expect(plan.texts.find((text) => text.objectId === "m_body")!.text).toContain("5 November 2026");
    apply(presentation, plan.requests);
    expect(() => verifyPeriodSlideText(presentation, plan.texts)).not.toThrow();
  });
});

describe("independent chart data", () => {
  it("keeps styles, replaces old ranges with four months and retains missing values as blanks", () => {
    const workbook: sheets_v4.Schema$Spreadsheet = { spreadsheetId: "copied-book", sheets: [{ properties: { sheetId: 7, title: "Chart data" }, charts: PERIOD_CHARTS.map((role, index) => ({
      chartId: index + 100, spec: { title: role.title, fontName: "Roboto", basicChart: {
        domains: [{ domain: { sourceRange: { sources: [{ sheetId: 7, startRowIndex: 1, endRowIndex: 7, startColumnIndex: index * 6, endColumnIndex: index * 6 + 1 }] } } }],
        series: Array.from({ length: index === 0 ? 1 : index === 1 ? 4 : 3 }, (_, col) => ({ colorStyle: { rgbColor: { red: 0.9 } }, series: { sourceRange: { sources: [{ sheetId: 7, startRowIndex: 1, endRowIndex: 7, startColumnIndex: index * 6 + col + 1, endColumnIndex: index * 6 + col + 2 }] } } })),
      } },
    })) }] };
    const rows = monthFixtures(2); rows[1].followers.followers = null;
    const d = buildPeriodData(reportPeriod(2), rows, [], "2027-03-04");
    const plan = planPeriodCharts(workbook, d);
    expect(plan.chartIds).toEqual({ followers: 100, types: 101, output: 102 });
    expect(plan.values[0].values).toEqual([["Month"], ["Nov 26"], ["Dec 26"], ["Jan 27"], ["Feb 27"]]);
    expect(plan.values[1].values![2]).toEqual([""]);
    expect(plan.requests[0].updateChartSpec!.spec!.fontName).toBe("Roboto");
    for (const request of plan.requests) {
      const basic = request.updateChartSpec!.spec!.basicChart!;
      expect(basic.headerCount).toBe(1);
      expect(basic.domains![0].domain!.sourceRange!.sources![0]).toMatchObject({ startRowIndex: 0, endRowIndex: 5 });
    }
    expect(workbook.sheets![0].charts![0].spec!.basicChart!.domains![0].domain!.sourceRange!.sources![0].endRowIndex).toBe(7);
  });
});
