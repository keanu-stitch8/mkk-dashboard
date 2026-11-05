import { describe, expect, it } from "vitest";
import { parseFiles } from "@/modules/import/parsers";
import { buildUploadPreview } from "./upload-preview";
import { followsOnlyDataset, instagramUploadOptions, prepareInstagramUpload } from "./instagram-upload";
import { csvFollowsDate } from "@/modules/social/shared/lib/csv-follows";

const parsed = () => parseFiles([{ name: "October.csv", data: new TextEncoder().encode([
  'Post ID,Account username,Publish time,Permalink,Post type,Views,Reach,Follows',
  'reel-1,main_ke_kudus,10/29/2026 08:00,https://www.instagram.com/reel/example/,IG reel,4000,3000,27',
  'zero,main_ke_kudus,10/28/2026 08:00,https://www.instagram.com/p/zero/,IG carousel,1000,500,0',
  'missing,main_ke_kudus,10/27/2026 08:00,https://www.instagram.com/p/missing/,IG carousel,1000,500,',
  'outside,main_ke_kudus,11/01/2026 08:00,https://www.instagram.com/p/outside/,IG carousel,1000,500,99',
].join('\n')) }]);
const old = [{ source: "meta_instagram", fileName: "API Meta Graph v26.0", createdAt: new Date("2026-11-04T08:00:00Z") }];

describe("Instagram CSV supplements", () => {
  it("defaults an API month to follows-only, keeping zero and filtering empty/out-of-month rows", () => {
    const result = prepareInstagramUpload(parsed(), "2026-10", old, true, { mode: "auto", observedOn: "2026-11-05" });
    expect(result.datasets[0].key).toBe("meta_ig_follows");
    expect(result.datasets[0].rows.map((r) => [r.postId, r.follows])).toEqual([["reel-1", 27], ["zero", 0]]);
    expect(result.datasets[0].metrics).toEqual([]);
    const preview = buildUploadPreview(result, "2026-10", old)[0];
    expect(preview.replaces).toBeNull();
    expect(preview.rowCount).toBe(2);
    expect(csvFollowsDate(preview.warnings.join("\n"))).toBe("2026-11-05");
  });
  it("does not replace locked months and keeps legacy full imports available without API data", () => {
    expect(() => prepareInstagramUpload(parsed(), "2026-10", old, true, { mode: "replace", observedOn: null })).toThrow("locked");
    expect(prepareInstagramUpload(parsed(), "2026-10", [], false, { mode: "auto", observedOn: null }).datasets[0].key).toBe("meta_instagram");
    expect(prepareInstagramUpload(parsed(), "2026-10", [], false, { mode: "follows", observedOn: null }).datasets[0].key).toBe("meta_ig_follows");
  });
  it("rejects conflicting duplicate IDs and false export dates", () => {
    const ds = parsed().datasets[0];
    ds.rows.push({ ...ds.rows[0], follows: 100 });
    expect(() => followsOnlyDataset(ds, "2026-10", null)).toThrow("Conflicting");
    expect(() => followsOnlyDataset(parsed().datasets[0], "2026-10", "2026-10-01")).toThrow("publish date");
    for (const date of ["2026-02-30", "2026-11-06"]) expect(() => instagramUploadOptions("follows", date, "2026-11-05")).toThrow();
    expect(instagramUploadOptions("auto", "", "2026-11-05").observedOn).toBeNull();
  });
});
