// Narasi laporan Website (bahasa Inggris, template kalimat + aturan watchout). Murni — mudah dites.
import { isIndonesianCity } from "../id-cities";

export interface WebsiteNarrativeInput {
  monthLabel: string;
  prevMonthLabel: string;
  users: number | null;
  pageviews: number | null;
  pagePaths: number;
  sessions: number | null;
  prevSessions: number | null;
  channels: { label: string; sessions: number; share: number | null; prevSessions: number | null }[];
  cities: { city: string; users: number }[];
  notSetSessions: number | null;
  gsc: { clicks: number | null; impressions: number | null; ctr: number | null; position: number | null; prevCtr: number | null };
}

const n = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const change = (cur: number, prev: number) => `${cur >= prev ? "rose" : "fell"} ${pct(Math.abs((cur - prev) / prev))}`;
const ORDINAL = ["Largest", "Second-largest", "Third-largest"];
const NOT_SET = "(not set)";
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0]);
/** Data lama menyimpan landing "(not set)" sebagai "/(not set)" (path dinormalisasi) — tampilkan apa adanya. */
export const landingPath = (path: string) => (/^\/\(.*\)$/.test(path) ? path.slice(1) : path);
const unusual = (city: string) => city !== NOT_SET && !isIndonesianCity(city);

export function websiteFindings(i: WebsiteNarrativeInput): string[] {
  const out: string[] = [];
  const [a, b] = i.channels;
  if (a) out.push(`${a.label} generated ${n(a.sessions)} sessions (${pct(a.share ?? 0)})${b ? `, followed by ${b.label} at ${n(b.sessions)} (${pct(b.share ?? 0)})` : ""}.`);
  if (i.pageviews != null && i.users)
    out.push(`The website recorded ${n(i.pageviews)} page views across ${n(i.pagePaths)} page paths and ${n(i.users)} active users (${(i.pageviews / i.users).toFixed(2)} views per user).`);
  const top = i.cities[0];
  if (top && i.users) out.push(`${top.city} is the largest city audience with ${n(top.users)} active users (${pct(top.users / i.users)} of site-wide active users).`);
  if (i.sessions != null && i.prevSessions) out.push(`Sessions ${change(i.sessions, i.prevSessions)} vs ${i.prevMonthLabel} (${n(i.prevSessions)} → ${n(i.sessions)}).`);
  // watchout: channel naik/turun > 50% MoM (basis bulan lalu ≥ 50 sesi)
  for (const c of i.channels)
    if (c.prevSessions != null && c.prevSessions >= 50 && Math.abs(c.sessions - c.prevSessions) / c.prevSessions > 0.5)
      out.push(`${c.label} sessions ${change(c.sessions, c.prevSessions)} MoM (${n(c.prevSessions)} → ${n(c.sessions)}).`);
  if (i.notSetSessions && i.sessions && i.notSetSessions / i.sessions > 0.05)
    out.push(`The landing-page dimension was “(not set)” for ${n(i.notSetSessions)} sessions (${pct(i.notSetSessions / i.sessions)}); these sessions restarted without a page load (typically a tab left open past GA4's 30-minute session timeout), so no landing page is recorded.`);
  const g = i.gsc;
  if (g.clicks != null && g.impressions != null)
    out.push(`Google Search Console recorded ${n(g.clicks)} clicks and ${n(g.impressions)} impressions (${pct(g.ctr ?? 0, 2)} CTR)${g.position != null ? ` at an average position of ${g.position.toFixed(1)}` : ""}.`);
  if (g.ctr != null && g.prevCtr != null && g.prevCtr - g.ctr > 0.02)
    out.push(`Search CTR fell ${((g.prevCtr - g.ctr) * 100).toFixed(1)} pp vs ${i.prevMonthLabel}; review titles and meta descriptions of top-impression pages.`);
  const odd = i.cities.filter((c) => unusual(c.city)).map((c) => c.city);
  if (odd.length) out.push(`City attribution is approximate. Treat ${list(odd)} as ${odd.length > 1 ? "locations" : "a location"} to validate before interpretation.`);
  return out;
}

export function cityNotes(cities: { city: string; users: number }[], siteUsers: number | null): { readout: string; note: string }[] {
  return cities.map((c, idx) => {
    if (c.city === NOT_SET) return { readout: "Location not identified by GA4.", note: "GA4 could not attribute a city to these users." };
    if (unusual(c.city))
      return { readout: "Unusual location for the target audience; validate before interpretation.", note: "Not in the Indonesian city reference list; validate before interpreting." };
    const base = idx < ORDINAL.length ? `${ORDINAL[idx]} city audience` : "Smaller city audience";
    return { readout: idx === 0 && siteUsers ? `${base}; ${pct(c.users / siteUsers)} of site-wide active users.` : `${base}.`, note: "City attribution is approximate in GA4." };
  });
}

export function geoReadout(cities: { city: string; users: number }[], siteUsers: number | null): string[] {
  if (!cities.length || !siteUsers) return [];
  const top3 = cities.slice(0, 3);
  const top3Users = top3.reduce((a, c) => a + c.users, 0);
  const shown = cities.reduce((a, c) => a + c.users, 0);
  return [
    `${cities[0].city} is the largest city audience: ${n(cities[0].users)} active users, or ${pct(cities[0].users / siteUsers)} of the site-wide total.`,
    `${top3.map((c) => c.city).join(", ")} combine for ${n(top3Users)} active users (${pct(top3Users / siteUsers)} of the site-wide total).`,
    `The ${cities.length} cities shown combine for ${n(shown)} active users (${pct(shown / siteUsers)} of the site-wide total).`,
    "GA4 city attribution is approximate; small or unexpected locations should be validated before interpretation.",
  ];
}
