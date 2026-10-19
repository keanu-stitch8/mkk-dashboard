import { describe, expect, it } from "vitest";
import { planFill, type SheetGrid } from "../lib/reports/engine/tokens";

const grid = (rows: string[][], merges: SheetGrid["merges"] = []): SheetGrid => ({ sheetId: 7, title: "01 Summary", rows, merges });

describe("planFill", () => {
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
});
