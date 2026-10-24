import { describe, expect, it } from "vitest";
import { buildYoutubeLogs } from "./youtube-log-rows";

const log = (title: string, status: string, videoId: string | null = null) => ({ date: "2026-09-01", title, url: null, videoId, format: null, category: null, editor: null, status });

describe("buildYoutubeLogs", () => {
  it("video Gantt in review: yang ada di Summary ditandai review, sisanya ditambah tanpa tanggal", () => {
    const out = buildYoutubeLogs([log("Sudah Tayang", "publish", "abc"), log("Masih Draft", "draft")], ["sudah tayang", "masih draft ", "Baru"]);
    expect(out.rows.map((r) => [r.title, r.status, r.date])).toEqual([
      ["Sudah Tayang", "publish", "2026-09-01"],
      ["Masih Draft", "review", "2026-09-01"],
      ["Baru", "review", null],
    ]);
    expect(out.rows[0].thumb).toBe("https://i.ytimg.com/vi/abc/mqdefault.jpg");
    expect([out.published, out.inReview]).toEqual([1, 2]);
  });
});
