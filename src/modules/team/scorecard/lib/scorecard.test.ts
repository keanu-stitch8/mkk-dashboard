import { describe, expect, it } from "vitest";
import { untrackedAssets } from "./scorecard";

const row = (landscape: string | null, portrait: string | null, video: string | null, interview: string | null) =>
  ({ landscape, portrait, video, interview }) as Parameters<typeof untrackedAssets>[0][number];

describe("untrackedAssets", () => {
  it("kelompok aset yang kosong di semua cerita = belum dicatat (Juli 2026: hanya Portrait Photo)", () => {
    expect(untrackedAssets([row(null, "available", null, null), row(null, null, null, null)])).toEqual(["portrait video", "interview video"]);
  });

  it("satu cerita terisi (termasuk missing) = dicatat; tanpa cerita = kosong", () => {
    expect(untrackedAssets([row(null, "available", "missing", null), row("available", null, null, "available")])).toEqual([]);
    expect(untrackedAssets([])).toEqual([]);
  });
});
