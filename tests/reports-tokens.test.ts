import { describe, expect, it } from "vitest";
import { planFill, type SheetGrid } from "../lib/reports/engine/tokens";

const grid = (rows: string[][], merges: SheetGrid["merges"] = []): SheetGrid => ({ sheetId: 7, title: "01 Summary", rows, merges });

describe("planFill", () => {
  it("openEnd: baris terakhir tabel dicatat untuk dihapus garis bawahnya", () => {
    const plan = planFill([grid([["{{#ch.name}}", "{{#ch.n}}"], ["{{x}}"]])], { values: { x: 1 }, tables: { ch: [{ name: "A", n: 1 }, { name: "B", n: 2 }, { name: "C", n: 3 }] }, openEnd: ["ch"] });
    expect(plan.openEnd).toEqual([{ sheetId: 7, row: 2, endCol: 2 }]);
  });

  it("menyembunyikan baris berisi penanda di hideRows (posisi setelah sisipan tabel)", () => {
    const plan = planFill(
      [grid([["{{#ch.name}}"], ["", "", "{{cat.9.name}}", "{{cat.9.count}}"], ["{{cat.8.name}}"]])],
      { values: { "cat.9.name": "Other", "cat.9.count": 0, "cat.8.name": "Teaser" }, tables: { ch: [{ name: "A" }, { name: "B" }] }, hideRows: ["cat.9.name"] },
    );
    expect(plan.hidden).toEqual([{ sheetId: 7, row: 2 }]);
  });

  it("mengisi nilai bertipe & teks campuran", () => {
    const plan = planFill([grid([["{{users}}", "Period: {{period}} · {{users}} users"]])], { values: { users: 1839, period: "1–30 September 2026" }, tables: {} });
    expect(plan.writes).toEqual([
      { sheetTitle: "01 Summary", row: 0, col: 0, value: 1839 },
      { sheetTitle: "01 Summary", row: 0, col: 1, value: "Period: 1–30 September 2026 · 1,839 users" },
    ]);
    expect(plan.inserts).toEqual([]);
  });

  it("menggandakan baris tabel, menggeser baris di bawahnya, mengulang merge", () => {
    const plan = planFill(
      [grid([["Channel", "Sessions"], ["{{#ch.name}}", "{{#ch.sessions}}"], ["Total", "{{total}}"]], [{ startRow: 1, endRow: 2, startCol: 0, endCol: 1 }])],
      { values: { total: 30 }, tables: { ch: [{ name: "Direct", sessions: 20 }, { name: "Search", sessions: 7 }, { name: "Social", sessions: 3 }] } },
    );
    expect(plan.inserts).toEqual([{ sheetId: 7, at: 2, count: 2 }]);
    expect(plan.merges).toEqual([
      { sheetId: 7, startRow: 2, endRow: 3, startCol: 0, endCol: 1 },
      { sheetId: 7, startRow: 3, endRow: 4, startCol: 0, endCol: 1 },
    ]);
    expect(plan.writes).toEqual([
      { sheetTitle: "01 Summary", row: 1, col: 0, value: "Direct" },
      { sheetTitle: "01 Summary", row: 1, col: 1, value: 20 },
      { sheetTitle: "01 Summary", row: 2, col: 0, value: "Search" },
      { sheetTitle: "01 Summary", row: 2, col: 1, value: 7 },
      { sheetTitle: "01 Summary", row: 3, col: 0, value: "Social" },
      { sheetTitle: "01 Summary", row: 3, col: 1, value: 3 },
      { sheetTitle: "01 Summary", row: 4, col: 1, value: 30 },
    ]);
  });

  it("tabel kosong → '—' di sel penanda pertama", () => {
    const plan = planFill([grid([["{{#q.text}}", "{{#q.clicks}}"]])], { values: {}, tables: { q: [] } });
    expect(plan.writes).toEqual([
      { sheetTitle: "01 Summary", row: 0, col: 0, value: "—" },
      { sheetTitle: "01 Summary", row: 0, col: 1, value: "" },
    ]);
  });

  it("penanda tak dikenal dibiarkan + peringatan; tone ikut di write", () => {
    const plan = planFill([grid([["{{nope}}", "{{kpi.views.change}}"]])], { values: { "kpi.views.change": "↑ +2.6% vs last month" }, tables: {}, tones: { "kpi.views.change": "good" } });
    expect(plan.writes).toEqual([{ sheetTitle: "01 Summary", row: 0, col: 1, value: "↑ +2.6% vs last month", tone: "good" }]);
    expect(plan.warnings).toEqual(['01 Summary!A1: penanda "nope" tidak dikenal']);
  });

  it("{{pagebreak}} dikosongkan + dicatat setelah sisipan tabel; autoHeight untuk tabel yang diminta", () => {
    const plan = planFill([grid([["{{#a.title}}"], ["", "{{pagebreak}}"]])], { values: {}, tables: { a: [{ title: "x" }, { title: "y" }] }, autoHeight: ["a"] });
    expect(plan.pageBreaks).toEqual([{ sheetId: 7, row: 2 }]);
    expect(plan.writes.at(-1)).toEqual({ sheetTitle: "01 Summary", row: 2, col: 1, value: "" });
    expect(plan.autoHeight).toEqual([{ sheetId: 7, startRow: 0, endRow: 2 }]);
    expect(plan.warnings).toEqual([]);
  });
});
