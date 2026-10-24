import { describe, expect, it } from "vitest";
import { firstParam, pickMonth } from "./month-param";

describe("month param", () => {
  it("memakai nilai pertama query string", () => {
    expect(firstParam(["2026-08", "2026-09"])).toBe("2026-08");
    expect(firstParam("2026-08")).toBe("2026-08");
    expect(firstParam(undefined)).toBeUndefined();
  });

  it("bulan valid dipakai walau belum ada datanya", () => {
    expect(pickMonth("2026-12", ["2026-08"], "2026-10-24")).toEqual({ month: "2026-12", months: ["2026-08"] });
  });

  it("param tidak valid / kosong → bulan terakhir yang ada datanya", () => {
    expect(pickMonth("2026-13", ["2026-07", "2026-09"], "2026-10-24").month).toBe("2026-09");
    expect(pickMonth(undefined, ["2026-07"], "2026-10-24").month).toBe("2026-07");
  });

  it("DB kosong → bulan berjalan", () => {
    expect(pickMonth(undefined, [], "2026-10-24").month).toBe("2026-10");
  });
});
