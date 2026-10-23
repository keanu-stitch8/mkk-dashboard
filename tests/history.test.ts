import { describe, expect, it } from "vitest";
import { groupSessions, pageNumbers, paginate } from "../lib/data/history";

const t = (min: number) => new Date(Date.UTC(2026, 9, 23, 0, min));

describe("groupSessions", () => {
  type Log = { id: string; start: Date; end: Date | null; trigger: string };
  const opts = { start: (r: Log) => r.start, end: (r: Log) => r.end, gapMs: 60_000, sameSession: (a: Log, b: Log) => a.trigger === b.trigger };

  it("baris beruntun (jeda dari akhir baris sebelumnya ≤ gap) jadi satu sesi, terbaru dulu", () => {
    const rows: Log[] = [
      { id: "a", start: t(0), end: t(3), trigger: "manual" },
      { id: "b", start: t(3), end: t(5), trigger: "manual" }, // mulai tepat saat a selesai
      { id: "c", start: t(30), end: t(31), trigger: "manual" }, // jeda 25 menit → sesi baru
    ];
    const s = groupSessions(rows, opts);
    expect(s.map((x) => x.rows.map((r) => r.id))).toEqual([["c"], ["b", "a"]]);
    expect(s[1].start).toEqual(t(0));
    expect(s[1].end).toEqual(t(5));
  });

  it("trigger berbeda memisahkan sesi walau waktunya berdekatan; input tak berurutan tetap benar", () => {
    const rows: Log[] = [
      { id: "cron", start: t(1), end: t(2), trigger: "cron" },
      { id: "man", start: t(0), end: t(1), trigger: "manual" },
    ];
    expect(groupSessions(rows, opts).map((x) => x.rows.map((r) => r.id))).toEqual([["cron"], ["man"]]);
  });

  it("tanpa `end` (mis. import) jeda dihitung dari waktu baris sebelumnya; baris running (end null) tidak error", () => {
    const rows = [{ at: t(0) }, { at: t(4) }, { at: t(20) }];
    expect(groupSessions(rows, { start: (r) => r.at, gapMs: 5 * 60_000 }).map((x) => x.rows.length)).toEqual([1, 2]);
    expect(groupSessions<Log>([{ id: "r", start: t(0), end: null, trigger: "cron" }], opts)[0].end).toEqual(t(0));
  });
});

describe("paginate & pageNumbers", () => {
  it("halaman dijepit ke batas", () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    expect(paginate(items, 3, 10)).toEqual({ items: [20, 21, 22], page: 3, pages: 3, total: 23 });
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, NaN, 10).page).toBe(1);
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pages: 1, total: 0 });
  });
  it("elipsis hanya untuk celah > 1 halaman", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(1, 5)).toEqual([1, 2, null, 5]);
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
  });
});
