import { describe, expect, it } from "vitest";
import { typeBreakdown } from "../lib/connectors/meta/map";

describe("typeBreakdown", () => {
  it("membaca breakdown media_product_type per metrik dari insight akun", () => {
    const res = {
      data: [
        { name: "views", total_value: { value: 300, breakdowns: [{ dimension_keys: ["media_product_type"], results: [{ dimension_values: ["REEL"], value: 200 }, { dimension_values: ["STORY"], value: 100 }] }] } },
        { name: "total_interactions", total_value: { value: 9, breakdowns: [{ dimension_keys: ["media_product_type"], results: [{ dimension_values: ["POST"], value: 9 }] }] } },
        { name: "reach", total_value: { value: 5 } },
      ],
    };
    expect(typeBreakdown(res)).toEqual([
      { metric: "views", type: "REEL", value: 200 },
      { metric: "views", type: "STORY", value: 100 },
      { metric: "total_interactions", type: "POST", value: 9 },
    ]);
  });
});
