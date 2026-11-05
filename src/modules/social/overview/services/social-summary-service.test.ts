import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSocialSummary } from "./social-summary-service";
import { findIgSnapshotViews } from "../../shared/repositories/social-repository";

vi.mock("../../shared/repositories/social-repository", () => ({
  ...Object.fromEntries([
    "findActiveSocialPosts", "findIgAccountByType", "findIgAccountMetrics", "findIgSnapshotViews",
    "findIgStoryDates", "findSocialImports", "findSocialLogs", "findSocialReviewItems",
  ].map((name) => [name, vi.fn().mockResolvedValue([])])),
  findFirstApiStory: vi.fn().mockResolvedValue(null),
  findSocialReviewImport: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/modules/shared/services/manual-metric-service", () => ({ getManualMetrics: vi.fn().mockResolvedValue({}) }));
vi.mock("@/modules/shared/services/quota-service", () => ({
  getQuotas: vi.fn().mockResolvedValue({ social: { key: "social", label: "Social", value: 60, override: false } }),
}));
vi.mock("../../shared/services/csv-follows-service", () => ({ getCsvPostFollows: vi.fn().mockResolvedValue([]) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findIgSnapshotViews).mockResolvedValue([]);
});

describe("post views at the selected reporting snapshot", () => {
  it.each([
    ["2026-10", "2026-11-04"],
    ["2026-11", "2026-12-04"],
    ["2027-02", "2027-03-04"],
    ["2028-02", "2028-03-04"],
  ])("queries the selected snapshot date for %s without a fallback", async (month, date) => {
    const summary = await getSocialSummary(month);
    expect(findIgSnapshotViews).toHaveBeenCalledExactlyOnceWith(date);
    expect(summary.monthViewsAsOf).toBeNull();
  });

  it("exposes the lock cut-off date without labelling it as October month-end", async () => {
    vi.mocked(findIgSnapshotViews).mockResolvedValue([{ mediaId: "post-1", views: 17000 }]);
    expect((await getSocialSummary("2026-10")).monthViewsAsOf).toBe("2026-11-04");
  });
});
