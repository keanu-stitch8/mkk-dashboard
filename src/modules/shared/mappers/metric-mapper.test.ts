import { describe, expect, it } from "vitest";
import { toMetricMap } from "./metric-mapper";

describe("toMetricMap", () => {
  it("key ganda: baris pertama menang", () => {
    expect(toMetricMap([{ key: "views", value: 1 }, { key: "views", value: 2 }, { key: "ctr", value: 0.05 }])).toEqual({ views: 1, ctr: 0.05 });
  });
});
