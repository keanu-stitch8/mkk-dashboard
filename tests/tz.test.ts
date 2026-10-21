import { describe, expect, it } from "vitest";
import { PACIFIC, WIB, addDays, dateIn, zonedInstant, zonedParts } from "../lib/tz";
import { monthRange } from "../lib/connectors/common";
import { cronSlot } from "../lib/connectors/cron";

describe("tz", () => {
  it("startTime laporan Reach (00:00 Pacific) → tanggal yang sama, PDT maupun PST", () => {
    expect(dateIn("2026-10-15T07:00:00Z", PACIFIC)).toBe("2026-10-15"); // PDT, UTC−7
    expect(dateIn("2026-12-15T08:00:00Z", PACIFIC)).toBe("2026-12-15"); // PST, UTC−8
    expect(dateIn("2026-12-15T07:00:00Z", PACIFIC)).toBe("2026-12-14"); // 23:00 PST hari sebelumnya
  });

  it("WIB", () => {
    expect(zonedParts("2026-09-30T17:30:00Z", WIB)).toEqual({ date: "2026-10-01", time: "00:30" });
    expect(dateIn("2026-09-30T16:59:00Z", WIB)).toBe("2026-09-30");
  });

  it("zonedInstant sadar DST (hari 23/25 jam)", () => {
    expect(new Date(zonedInstant("2026-10-01", "00:00", WIB)).toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(new Date(zonedInstant("2026-07-01", "00:00", PACIFIC)).toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(new Date(zonedInstant("2026-12-01", "00:00", PACIFIC)).toISOString()).toBe("2026-12-01T08:00:00.000Z");
    // 1 Nov 2026 kembali ke PST: hari itu 25 jam
    expect(zonedInstant("2026-11-02", "00:00", PACIFIC) - zonedInstant("2026-11-01", "00:00", PACIFIC)).toBe(25 * 3600_000);
    // 8 Mar 2026 masuk PDT: hari itu 23 jam
    expect(zonedInstant("2026-03-09", "00:00", PACIFIC) - zonedInstant("2026-03-08", "00:00", PACIFIC)).toBe(23 * 3600_000);
  });

  it("addDays lintas bulan/tahun", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("monthRange memotong bulan berjalan per zona API", () => {
    const now = new Date("2026-10-20T03:00:00Z"); // 20 Okt 10:00 WIB = 19 Okt 20:00 PDT
    expect(monthRange("2026-10", now).end).toBe("2026-10-20");
    expect(monthRange("2026-10", now, PACIFIC).end).toBe("2026-10-19");
  });

  it("cronSlot: tanggal potong 5 jam 07:00 WIB", () => {
    expect(cronSlot(new Date("2026-10-20T13:00:00Z"))).toEqual({ slot: new Date("2026-10-05T00:00:00Z"), month: "2026-09" });
    expect(cronSlot(new Date("2026-10-04T23:59:00Z")).month).toBe("2026-08");
  });
});
