import { describe, expect, it } from "vitest";
import { defaultPeriod, periodAt, periodParam, periodPostSnapshotDate, reportPeriod } from "./period";
import { parsePeriodRequest } from "./options";

describe("four-month reporting calendar", () => {
  it("uses the closing month's lock cut-off consistently across periods", () => {
    expect(periodPostSnapshotDate(reportPeriod(1))).toBe("2026-11-04");
    expect(periodPostSnapshotDate(reportPeriod(2))).toBe("2027-03-04");
  });
  it("starts in July and keeps numbering across years", () => {
    expect(reportPeriod(1)).toMatchObject({ startDate: "2026-07-01", endDate: "2026-10-31", days: 123, rangeLabel: "July to October 2026" });
    expect(reportPeriod(2)).toMatchObject({ months: ["2026-11", "2026-12", "2027-01", "2027-02"], endDate: "2027-02-28", days: 120, rangeLabel: "November 2026 to February 2027" });
    expect(reportPeriod(3)).toMatchObject({ startDate: "2027-03-01", endDate: "2027-06-30" });
    expect(reportPeriod(5)).toMatchObject({ endDate: "2028-02-29", days: 121 });
  });
  it("defaults to the last completed period and rejects invalid numbers", () => {
    expect(periodAt("2026-11-05")).toBe(2);
    expect(defaultPeriod("2026-11-05")).toBe(1);
    expect(defaultPeriod("2027-03-01")).toBe(2);
    expect(periodParam("2", "2026-11-05")).toBe(2);
    expect(periodParam("999", "2026-11-05")).toBe(1);
    for (const n of [0, -1, 1.5, Infinity, 1201]) expect(() => reportPeriod(n)).toThrow();
  });
});

describe("period generation input", () => {
  it("accepts a case, explicit organic confirmation and a future goal", () => {
    expect(parsePeriodRequest({ period: 1, casePostId: "ig-1", organic: true, followerTarget: 3000, targetDate: "2026-12-31" })).toEqual({
      number: 1, options: { casePostId: "ig-1", organic: true, followerTarget: 3000, targetDate: "2026-12-31" },
    });
  });
  it("rejects invalid dates, partial goals, invalid booleans and dates inside the period", () => {
    for (const body of [null, {}, { period: "1" }, { period: 1, organic: "true" }, { period: 1, followerTarget: 3000 }, { period: 1, followerTarget: 3000, targetDate: "2026-11-31" }, { period: 1, followerTarget: 3000, targetDate: "2026-10-31" }, { period: 1, followerTarget: -1, targetDate: "2026-12-31" }]) {
      expect(() => parsePeriodRequest(body)).toThrow();
    }
  });
});
