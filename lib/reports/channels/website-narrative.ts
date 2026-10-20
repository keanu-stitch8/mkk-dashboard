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

import { capitalize, list, monthOnly, n, pct, shareOf } from "./narrative-utils";

/** Data lama menyimpan landing "(not set)" sebagai "/(not set)" (path dinormalisasi) — tampilkan apa adanya. */
export const landingPath = (path: string) => (/^\/\(.*\)$/.test(path) ? path.slice(1) : path);

/** Top N landing page untuk tabel: "(not set)" dikeluarkan (ambigu bagi client; dijelaskan di temuan), baris berikutnya naik. */
export const topLandings = <T extends { path: string }>(rows: T[], n = 10): T[] => rows.filter((r) => landingPath(r.path) !== "(not set)").slice(0, n);

/**
 * Temuan Website. Kalimat pembuka = gambaran bulan (sesi naik/turun + channel penyebab terbesar); angka yang sudah ada
 * di kartu KPI tidak diulang kecuali diberi konteks.
 */
export function websiteFindings(i: WebsiteNarrativeInput): string[] {
  const out: string[] = [];
  const prevM = monthOnly(i.prevMonthLabel, i.monthLabel);
  const sign = (d: number) => (d > 0 ? `+${n(d)}` : `−${n(Math.abs(d))}`);

  // 1. pembuka: arah sesi + channel yang paling menjelaskan perubahan (≥ 30% dari selisih total)
  if (i.sessions != null && i.prevSessions) {
    const total = i.sessions - i.prevSessions;
    const driver = [...i.channels]
      .filter((c) => c.prevSessions != null)
      .map((c) => ({ ...c, diff: c.sessions - c.prevSessions! }))
      .filter((c) => Math.sign(c.diff) === Math.sign(total))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
    const why = driver && total !== 0 && Math.abs(driver.diff) / Math.abs(total) >= 0.3 ? ` The biggest change came from ${driver.label} (${sign(driver.diff)} sessions).` : "";
    out.push(`Visits ${i.sessions >= i.prevSessions ? "rose" : "fell"} ${pct(Math.abs(total / i.prevSessions), 0)} from ${prevM} to ${n(i.sessions)} sessions.${why}`);
  }
  // 2. sumber kunjungan
  const [a, b] = i.channels;
  if (a) {
    out.push(`${a.label} brought in ${a.share != null ? shareOf(a.share, "all visits") : "the most visits"} (${n(a.sessions)})${b ? `, followed by ${b.label} with ${n(b.sessions)}` : ""}.`);
  }
  // channel lain yang berubah tajam (> 50%, basis bulan lalu ≥ 50 sesi)
  for (const c of i.channels.slice(1))
    if (c.prevSessions != null && c.prevSessions >= 50 && Math.abs(c.sessions - c.prevSessions) / c.prevSessions > 0.5)
      out.push(
        c.sessions >= c.prevSessions * 2
          ? `${c.label} visits more than doubled from ${prevM} (${n(c.prevSessions)} to ${n(c.sessions)}).`
          : `${c.label} visits ${c.sessions > c.prevSessions ? "rose" : "fell"} from ${n(c.prevSessions)} to ${n(c.sessions)}.`,
      );
  // 3. kedalaman kunjungan (tidak ada di kartu)
  if (i.pageviews != null && i.users) out.push(`Each visitor viewed ${(i.pageviews / i.users).toFixed(1)} pages on average, spread over ${n(i.pagePaths)} different pages.`);
  // 4. kota
  const [c1, c2] = i.cities;
  if (c1 && i.users) {
    out.push(`${c1.city} is the largest audience with ${n(c1.users)} users, ${shareOf(c1.users / i.users, "the total")}${c2 ? `, followed by ${c2.city} (${n(c2.users)})` : ""}.`);
  }
  // 5. Google Search: kartu sudah menampilkan clicks/CTR → kalimat hanya bila CTR turun berarti
  const g = i.gsc;
  if (g.ctr != null && g.prevCtr != null && g.prevCtr - g.ctr > 0.02)
    out.push(
      `The share of Google searchers who clicked through fell from ${pct(g.prevCtr)} to ${pct(g.ctr)}. The titles and descriptions of the most-shown pages are worth reviewing.`,
    );
  else if (g.clicks != null && g.position != null) out.push(`Google Search sent ${n(g.clicks)} clicks, with pages appearing at an average position of ${g.position.toFixed(1)}.`);
  // 6. lalu lintas yang dikeluarkan dari peringkat kota
  const x = i.excluded;
  if (x.outsideUsers > 0) {
    const who = i.users ? capitalize(shareOf(x.outsideUsers / i.users, "users", true)) : `${n(x.outsideUsers)} users`;
    const where = x.outsideTop.length ? ` such as ${list(x.outsideTop)}` : "";
    const notSet = x.notSetUsers > 0 ? `, along with ${n(x.notSetUsers)} users whose city is unknown` : "";
    out.push(
      `${who}${i.users ? ` (${n(x.outsideUsers)})` : ""} came from data centre locations abroad${where}. These are most likely bots, so they are left out of the city ranking${notSet}.`,
    );
  } else if (x.notSetUsers > 0) out.push(`${n(x.notSetUsers)} users could not be matched to a city and are left out of the city ranking.`);
  // 7. landing tidak tercatat
  if (i.notSetSessions && i.sessions && i.notSetSessions / i.sessions > 0.05)
    out.push(
      `${n(i.notSetSessions)} visits (${pct(i.notSetSessions / i.sessions, 0)}) had no recorded landing page, which usually happens when someone returns to a tab left open for more than 30 minutes.`,
    );
  return out;
}
