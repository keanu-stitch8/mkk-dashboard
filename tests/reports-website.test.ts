import { describe, expect, it } from "vitest";
import { landingPath, topLandings, websiteFindings, type WebsiteNarrativeInput } from "../lib/reports/channels/website-narrative";

const sep: WebsiteNarrativeInput = {
  monthLabel: "September 2026",
  prevMonthLabel: "August 2026",
  users: 835,
  pageviews: 7203,
  pagePaths: 431,
  sessions: 1839,
  prevSessions: 1500,
  channels: [
    { label: "Direct", sessions: 905, share: 0.492, prevSessions: 400 },
    { label: "Organic Search", sessions: 632, share: 0.344, prevSessions: 600 },
  ],
  cities: [
    { city: "Kudus", users: 301, prevUsers: 237 },
    { city: "Semarang", users: 168, prevUsers: 181 },
    { city: "Jakarta", users: 98, prevUsers: null },
  ],
  excluded: { outsideUsers: 202, outsideTop: ["Tel Aviv-Yafo", "Prineville", "Lulea"], notSetUsers: 20 },
  notSetSessions: 147,
  gsc: { clicks: 98, impressions: 546, ctr: 0.1795, position: 8.62, prevCtr: 0.2123 },
};

describe("website narrative", () => {
  it("temuan: kalimat pendek tanpa tanda pisah", () => {
    const f = websiteFindings(sep);
    expect(f).toEqual([
      "Direct brought in 905 sessions (49.2%), followed by Organic Search with 632 (34.4%).",
      "835 users viewed 7,203 pages across 431 URLs, an average of 8.6 pages per user.",
      "Kudus is the largest audience with 301 users, 36.0% of the total.",
      "Sessions rose 22.6% from August 2026 (1,500 to 1,839).",
      "Direct sessions rose 126.3% from August 2026 (400 to 905).",
      "147 sessions (8.0%) had no recorded landing page. This usually happens when a visitor returns to a tab left open for more than 30 minutes.",
      "Google Search sent 98 clicks from 546 impressions, a click-through rate of 17.95% at an average position of 8.6.",
      "Click-through rate from Google fell 3.3 percentage points from August 2026. The titles and descriptions of the most-shown pages are worth reviewing.",
      "202 users (24.2%) were located outside Indonesia, mainly in Tel Aviv-Yafo, Prineville and Lulea. This is largely automated traffic from data centres, so these locations are left out of the city ranking, together with 20 users whose city could not be identified.",
    ]);
    expect(f.join(" ")).not.toMatch(/—|“|”/);
  });

  it("tanpa kota luar negeri / not set → tidak ada kalimat pengecualian", () => {
    expect(websiteFindings({ ...sep, excluded: { outsideUsers: 0, outsideTop: [], notSetUsers: 0 } }).some((f) => f.includes("outside Indonesia"))).toBe(false);
  });

  it("landing '/(not set)' lama dibaca sebagai '(not set)'", () => {
    expect(landingPath("/(not set)")).toBe("(not set)");
    expect(landingPath("/news")).toBe("/news");
  });

  it("top landing: '(not set)' dikeluarkan, tetap 10 baris", () => {
    const rows = ["/", "/(not set)", ...Array.from({ length: 12 }, (_, i) => `/p${i}`)].map((path, i) => ({ path, sessions: 100 - i }));
    const top = topLandings(rows);
    expect(top).toHaveLength(10);
    expect(top.map((r) => r.path)).not.toContain("/(not set)");
    expect(top[1].path).toBe("/p0");
  });
});
