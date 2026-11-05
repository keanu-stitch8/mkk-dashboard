import { describe, expect, it } from "vitest";
import { csvFollowsDate, withCsvFollows } from "./csv-follows";
import { toCsvPostFollows } from "../mappers/csv-follows-mapper";

describe("CSV follows attribution", () => {
  it("only supplements exact Instagram IDs without changing other metrics or losing zeros", () => {
    const posts = [
      { platform: "instagram", postId: "1", follows: null, views: 16446 },
      { platform: "instagram", postId: "2", follows: 5, views: 500 },
      { platform: "facebook", postId: "1", follows: null, views: 100 },
    ];
    const result = withCsvFollows(posts, [{ postId: "1", follows: 0, observedOn: null, importedOn: "2026-11-05" }]);
    expect(result.map((p) => p.follows)).toEqual([0, 5, null]);
    expect(result.map((p) => p.views)).toEqual([16446, 500, 100]);
    expect(posts[0].follows).toBeNull();
    expect(withCsvFollows(posts, [])[0].follows).toBeNull();
  });
  it("keeps upload dates separate from unknown export dates", () => {
    const row = { label: "1", value: 278, import: { note: "Instagram follows CSV export date: unknown.", createdAt: new Date("2026-11-05T01:00:00Z") } };
    expect(toCsvPostFollows(row)).toEqual({ postId: "1", follows: 278, observedOn: null, importedOn: "2026-11-05" });
    expect(csvFollowsDate("Instagram follows CSV export date: 2026-02-30.")).toBeNull();
  });
});
