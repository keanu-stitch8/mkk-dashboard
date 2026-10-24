import { describe, expect, it } from "vitest";
import { kpiData, type KpiDef } from "../src/lib/reports/kpi";

type S = { views: number | null; er: number | null; pos: number | null; time: number | null };
const defs: KpiDef<S>[] = [
  { key: "views", label: "Views", kind: "count", get: (s) => s.views },
  { key: "er", label: "Engagement rate", kind: "rate", get: (s) => s.er },
  { key: "pos", label: "Avg position", kind: "decimal", goodWhenUp: false, get: (s) => s.pos },
  { key: "time", label: "Avg engagement time", kind: "duration", get: (s) => s.time },
];

describe("kpiData", () => {
  it("nilai, perubahan EN (% / pp), tone termasuk 'turun = bagus'", () => {
    const d = kpiData(defs, { views: 732, er: 0.0444, pos: 8.6, time: 104 }, { views: 2456, er: 0.0534, pos: 9.6, time: 127 });
    expect(d.values["kpi.views.label"]).toBe("Views");
    expect(d.values["kpi.views.value"]).toBe(732);
    expect(d.values["kpi.views.change"]).toBe("↓ −70,2% vs last month");
    expect(d.tones["kpi.views.change"]).toBe("bad");
    expect(d.values["kpi.er.change"]).toBe("↓ −0,9 percentage points vs last month");
    // metrik "turun = bagus": diberi kata (up)/(down) supaya panah ↓ hijau tidak membingungkan
    expect(d.values["kpi.pos.change"]).toBe("↓ −10,4% vs last month (up)");
    expect(d.tones["kpi.pos.change"]).toBe("good");
    expect(d.values["kpi.time.value"]).toBe("1m 44s");
  });

  it("tanpa bulan lalu", () => {
    const d = kpiData(defs, { views: 10, er: null, pos: null, time: null }, null);
    expect(d.values["kpi.views.change"]).toBe("No data last month");
    expect(d.tones["kpi.views.change"]).toBe("none");
    expect(d.values["kpi.er.value"]).toBe(null);
  });

  it("metrik turun = bagus yang naik → (down)", () => {
    const d = kpiData(defs, { views: 1, er: 0.1, pos: 9.6, time: 1 }, { views: 1, er: 0.1, pos: 8.6, time: 1 });
    expect(d.values["kpi.pos.change"]).toBe("↑ +11,6% vs last month (down)");
    expect(d.tones["kpi.pos.change"]).toBe("bad");
    expect(d.values["kpi.views.change"]).toBe("→ 0,0% vs last month");
  });
});
