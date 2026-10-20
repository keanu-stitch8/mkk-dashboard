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
      // pembuka: arah + channel penyebab; angka kartu (users, views) tidak diulang
      "Visits rose 23% from August to 1,839 sessions. The biggest change came from Direct (+505 sessions).",
      "Direct brought in almost half of all visits (905), followed by Organic Search with 632.",
      "Each visitor viewed 8.6 pages on average, spread over 431 different pages.",
      "Kudus is the largest audience with 301 users, 36% of the total, followed by Semarang (168).",
      "The share of Google searchers who clicked through fell from 21.2% to 18.0%. The titles and descriptions of the most-shown pages are worth reviewing.",
      "About a quarter of users (202) came from data centre locations abroad such as Tel Aviv-Yafo, Prineville and Lulea. These are most likely bots, so they are left out of the city ranking, along with 20 users whose city is unknown.",
      "147 visits (8%) had no recorded landing page, which usually happens when someone returns to a tab left open for more than 30 minutes.",
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
