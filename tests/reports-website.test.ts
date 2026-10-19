import { describe, expect, it } from "vitest";
import { cityNotes, landingPath, topLandings, websiteFindings, type WebsiteNarrativeInput } from "../lib/reports/channels/website-narrative";

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
    { city: "Kudus", users: 301 },
    { city: "Semarang", users: 168 },
    { city: "Jakarta", users: 98 },
  ],
  excluded: { outsideUsers: 202, outsideTop: ["Tel Aviv-Yafo", "Prineville", "Lulea"], notSetUsers: 20 },
  notSetSessions: 147,
  gsc: { clicks: 98, impressions: 546, ctr: 0.1795, position: 8.62, prevCtr: 0.2123 },
};

describe("website narrative", () => {
  it("temuan utama + watchout", () => {
    expect(websiteFindings(sep)).toEqual([
      "Direct generated 905 sessions (49.2%), followed by Organic Search at 632 (34.4%).",
      "The website recorded 7,203 page views across 431 page paths and 835 active users (8.63 views per user).",
      "Kudus is the largest city audience with 301 active users (36.0% of site-wide active users).",
      "Sessions rose 22.6% vs August 2026 (1,500 → 1,839).",
      "Direct sessions rose 126.3% MoM (400 → 905).",
      "The landing-page dimension was “(not set)” for 147 sessions (8.0%); these sessions restarted without a page load (typically a tab left open past GA4's 30-minute session timeout), so no landing page is recorded.",
      "Google Search Console recorded 98 clicks and 546 impressions (17.95% CTR) at an average position of 8.6.",
      "Search CTR fell 3.3 percentage points vs August 2026; review titles and meta descriptions of top-impression pages.",
      "Locations outside Indonesia accounted for 202 active users (24.2%), led by Tel Aviv-Yafo, Prineville and Lulea — largely data-centre locations typical of crawler/bot traffic. They are excluded from the city ranking, as are 20 users without an identified city.",
    ]);
  });

  it("catatan kota (hanya kota Indonesia)", () => {
    const notes = cityNotes(sep.cities, sep.users);
    expect(notes[0]).toEqual({ readout: "Largest city audience; 36.0% of site-wide active users.", note: "City attribution is approximate in GA4." });
    expect(notes[1].readout).toBe("Second-largest city audience.");
    expect(notes[2].readout).toBe("Third-largest city audience.");
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
