// Zona waktu: semua konversi instant ↔ tanggal lewat zona IANA (Intl), tanpa offset jam hardcode (+7 / −8),
// supaya DST (Pacific: PDT UTC−7 / PST UTC−8) selalu benar.
//   WIB      → tanggal dashboard (Asia/Jakarta)
//   PACIFIC  → hari laporan YouTube Analytics/Reporting API & Search Console (didokumentasikan Google)
//   GA4      → zona properti, dibaca dari metadata.timeZone respons API

export const WIB = "Asia/Jakarta";
export const PACIFIC = "America/Los_Angeles";

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const fmt = (tz: string) => {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmtCache.set(tz, f);
  }
  return f;
};

/** Waktu dinding sebuah instant di zona `tz`: tanggal YYYY-MM-DD dan jam HH:mm. */
export function zonedParts(instant: Date | number | string, tz: string): { date: string; time: string } {
  const ms = instant instanceof Date ? instant.getTime() : typeof instant === "number" ? instant : Date.parse(instant);
  const p = Object.fromEntries(fmt(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Tanggal (YYYY-MM-DD) sebuah instant di zona `tz`. */
export const dateIn = (instant: Date | number | string, tz: string): string => zonedParts(instant, tz).date;

/** Tambah `n` hari kalender ke tanggal YYYY-MM-DD (aritmetika kalender murni, tanpa zona). */
export const addDays = (date: string, n: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/** Instant (epoch ms) untuk waktu dinding `date` `time` di zona `tz` — sadar DST. */
export function zonedInstant(date: string, time: string, tz: string): number {
  const wall = Date.parse(`${date}T${time}:00Z`);
  const asWall = (ms: number) => Date.parse(`${zonedParts(ms, tz).date}T${zonedParts(ms, tz).time}:00Z`);
  // cari instant yang waktu dindingnya di tz = wall (dua iterasi cukup untuk lompatan DST)
  let utc = wall - (asWall(wall) - wall);
  utc = wall - (asWall(utc) - utc);
  return utc;
}
