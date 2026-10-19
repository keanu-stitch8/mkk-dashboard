// Narasi laporan Website untuk client (bahasa Inggris). Gaya: kalimat pendek dan lugas, tanpa tanda pisah
// atau jargon teknis, satu fakta per kalimat. Murni — mudah dites.

export interface WebsiteNarrativeInput {
  monthLabel: string;
  prevMonthLabel: string;
  users: number | null;
  pageviews: number | null;
  pagePaths: number;
  sessions: number | null;
  prevSessions: number | null;
  channels: { label: string; sessions: number; share: number | null; prevSessions: number | null }[];
  /** kota Indonesia saja (tanpa "(not set)"), urut active users */
  cities: { city: string; users: number; prevUsers?: number | null }[];
  /** dikeluarkan dari peringkat: lokasi luar Indonesia (sering crawler/data center) & kota tak teridentifikasi */
  excluded: { outsideUsers: number; outsideTop: string[]; notSetUsers: number };
  notSetSessions: number | null;
  gsc: { clicks: number | null; impressions: number | null; ctr: number | null; position: number | null; prevCtr: number | null };
}

const n = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const change = (cur: number, prev: number) => `${cur >= prev ? "rose" : "fell"} ${pct(Math.abs((cur - prev) / prev))}`;
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0]);

/** Data lama menyimpan landing "(not set)" sebagai "/(not set)" (path dinormalisasi) — tampilkan apa adanya. */
export const landingPath = (path: string) => (/^\/\(.*\)$/.test(path) ? path.slice(1) : path);

/** Top N landing page untuk tabel: "(not set)" dikeluarkan (ambigu bagi client; dijelaskan di temuan), baris berikutnya naik. */
export const topLandings = <T extends { path: string }>(rows: T[], n = 10): T[] => rows.filter((r) => landingPath(r.path) !== "(not set)").slice(0, n);

export function websiteFindings(i: WebsiteNarrativeInput): string[] {
  const out: string[] = [];
  const [a, b] = i.channels;
  if (a) out.push(`${a.label} brought in ${n(a.sessions)} sessions (${pct(a.share ?? 0)})${b ? `, followed by ${b.label} with ${n(b.sessions)} (${pct(b.share ?? 0)})` : ""}.`);
  if (i.pageviews != null && i.users)
    out.push(`${n(i.users)} users viewed ${n(i.pageviews)} pages across ${n(i.pagePaths)} URLs, an average of ${(i.pageviews / i.users).toFixed(1)} pages per user.`);
  const top = i.cities[0];
  if (top && i.users) out.push(`${top.city} is the largest audience with ${n(top.users)} users, ${pct(top.users / i.users)} of the total.`);
  if (i.sessions != null && i.prevSessions) out.push(`Sessions ${change(i.sessions, i.prevSessions)} from ${i.prevMonthLabel} (${n(i.prevSessions)} to ${n(i.sessions)}).`);
  // channel yang naik/turun > 50% (basis bulan lalu ≥ 50 sesi)
  for (const c of i.channels)
    if (c.prevSessions != null && c.prevSessions >= 50 && Math.abs(c.sessions - c.prevSessions) / c.prevSessions > 0.5)
      out.push(`${c.label} sessions ${change(c.sessions, c.prevSessions)} from ${i.prevMonthLabel} (${n(c.prevSessions)} to ${n(c.sessions)}).`);
  if (i.notSetSessions && i.sessions && i.notSetSessions / i.sessions > 0.05)
    out.push(
      `${n(i.notSetSessions)} sessions (${pct(i.notSetSessions / i.sessions)}) had no recorded landing page. This usually happens when a visitor returns to a tab left open for more than 30 minutes.`,
    );
  const g = i.gsc;
  if (g.clicks != null && g.impressions != null)
    out.push(`Google Search sent ${n(g.clicks)} clicks from ${n(g.impressions)} impressions, a click-through rate of ${pct(g.ctr ?? 0, 2)}${g.position != null ? ` at an average position of ${g.position.toFixed(1)}` : ""}.`);
  if (g.ctr != null && g.prevCtr != null && g.prevCtr - g.ctr > 0.02)
    out.push(
      `Click-through rate from Google fell ${((g.prevCtr - g.ctr) * 100).toFixed(1)} percentage points from ${i.prevMonthLabel}. The titles and descriptions of the most-shown pages are worth reviewing.`,
    );
  const x = i.excluded;
  if (x.outsideUsers > 0) {
    const share = i.users ? ` (${pct(x.outsideUsers / i.users)})` : "";
    const where = x.outsideTop.length ? `, mainly in ${list(x.outsideTop)}` : "";
    const notSet = x.notSetUsers > 0 ? `, together with ${n(x.notSetUsers)} users whose city could not be identified` : "";
    out.push(
      `${n(x.outsideUsers)} users${share} were located outside Indonesia${where}. This is largely automated traffic from data centres, so these locations are left out of the city ranking${notSet}.`,
    );
  } else if (x.notSetUsers > 0) out.push(`${n(x.notSetUsers)} users could not be matched to a city and are left out of the city ranking.`);
  return out;
}
