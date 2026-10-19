import { describe, expect, it } from "vitest";
import { cityNotes, websiteFindings, type WebsiteNarrativeInput } from "../lib/reports/channels/website-narrative";

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
    { city: "Tel Aviv-Yafo", users: 23 },
  ],
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
      "The landing-page dimension was “(not set)” for 147 sessions (8.0%); review landing-page tagging.",
      "Google Search Console recorded 98 clicks and 546 impressions (17.95% CTR) at an average position of 8.6.",
      "Search CTR fell 3.3 pp vs August 2026; review titles and meta descriptions of top-impression pages.",
      "City attribution is approximate. Treat Tel Aviv-Yafo as a location to validate before interpretation.",
    ]);
  });

  it("catatan kota", () => {
    const notes = cityNotes(sep.cities, sep.users);
    expect(notes[0]).toEqual({ readout: "Largest city audience; 36.0% of site-wide active users.", note: "City attribution is approximate in GA4." });
    expect(notes[1].readout).toBe("Second-largest city audience.");
    expect(notes[2]).toEqual({ readout: "Unusual location for the target audience; validate before interpretation.", note: "Not in the Indonesian city reference list; validate before interpreting." });
  });

  it("(not set) bukan lokasi tak biasa; daftar kota memakai koma", () => {
    const cities = [
      { city: "Kudus", users: 301 },
      { city: "(not set)", users: 32 },
      { city: "Tel Aviv-Yafo", users: 23 },
      { city: "Prineville", users: 17 },
      { city: "Lulea", users: 13 },
    ];
    expect(websiteFindings({ ...sep, cities }).at(-1)).toBe("City attribution is approximate. Treat Tel Aviv-Yafo, Prineville and Lulea as locations to validate before interpretation.");
    expect(cityNotes(cities, 835)[1]).toEqual({ readout: "Location not identified by GA4.", note: "GA4 could not attribute a city to these users." });
  });
});
