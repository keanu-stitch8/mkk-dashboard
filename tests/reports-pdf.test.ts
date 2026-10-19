import { describe, expect, it } from "vitest";
import { pdfExportUrl } from "../lib/reports/engine/pdf";

describe("pdfExportUrl", () => {
  it("A4 landscape, pas lebar, tanpa gridlines, header beku diulang", () => {
    const u = new URL(pdfExportUrl("abc123"));
    expect(u.origin + u.pathname).toBe("https://docs.google.com/spreadsheets/d/abc123/export");
    const p = Object.fromEntries(u.searchParams);
    expect(p).toMatchObject({ format: "pdf", size: "A4", portrait: "false", scale: "2", gridlines: "false", sheetnames: "false", printtitle: "false", fzr: "true" });
    expect(p.gid).toBeUndefined();
  });

  it("per sheet + fit to page (Executive Summary 1 halaman)", () => {
    const p = Object.fromEntries(new URL(pdfExportUrl("abc123", { gid: 42, fit: "page" })).searchParams);
    expect(p.gid).toBe("42");
    expect(p.scale).toBe("4");
  });
});
