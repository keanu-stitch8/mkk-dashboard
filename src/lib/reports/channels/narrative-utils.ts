// Alat bantu kalimat narasi laporan (bahasa Inggris) — dipakai Website, News, YouTube. Tujuannya kalimat yang terasa
// ditulis analis: angka dibulatkan bila wajar ("almost half"), tahun tidak diulang, judul dipendekkan, dan perubahan
// besar disertai penyebabnya dari data.

// angka gaya Indonesia dengan teks English (sama dengan dashboard, locale en-ID): 1.353 · 18,0% · 7,4
export const n = (v: number) => v.toLocaleString("en-ID", { maximumFractionDigits: 0 });
/** Desimal tetap d digit: 7.36 → "7,4". */
export const dec = (v: number, d = 1) => v.toLocaleString("en-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
/** Persen dengan pembulatan biasa (17.95 → "18,0%"; toFixed saja memberi "17,9%" karena galat floating point). */
export const pct = (v: number, d = 1) => `${dec(Math.round(v * 100 * 10 ** d + 1e-9) / 10 ** d, d)}%`;
export const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;
export const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));

/** "August 2026" dibanding "September 2026" → "August" (tahun sama tidak perlu diulang). */
export const monthOnly = (label: string, ref: string) => (label.split(" ")[1] === ref.split(" ")[1] ? label.split(" ")[0] : label);

/** Porsi dalam kata bila dekat pecahan umum, selain itu null (pakai persen). */
export function shareWords(x: number): string | null {
  if (x >= 0.95) return "almost all";
  if (x >= 0.72 && x <= 0.78) return "about three quarters";
  if (x >= 0.63 && x <= 0.7) return "about two thirds";
  if (x > 0.5 && x <= 0.55) return "just over half";
  if (x >= 0.45 && x <= 0.5) return "almost half";
  if (x >= 0.3 && x <= 0.36) return "about a third";
  if (x >= 0.23 && x <= 0.27) return "about a quarter";
  if (x >= 0.18 && x <= 0.22) return "about 1 in 5";
  if (x >= 0.09 && x <= 0.11) return "about 1 in 10";
  return null;
}

/** Judul panjang → bagian pertama sebelum " | " atau ", " (mis. "MARKASS Sport Center, Beragam …" → "MARKASS Sport Center"). */
export function shortTitle(title: string): string {
  const first = title.split(/ \| |, /)[0].trim();
  const t = first.length >= 12 ? first : title.trim();
  return t.length <= 60 ? t : `${t.slice(0, 57).replace(/\s+\S*$/, "")}...`;
}

/**
 * Perubahan total bulan ini vs bulan lalu, disertai penyebab bila jelas dari data: satu konten mendominasi
 * (≥ 40% dari total bulan itu). Perubahan kecil (< 30%) → kalimat biasa.
 */
export function changeWithCause(o: {
  metric: string;
  unit: string;
  cur: number;
  prev: number;
  prevMonth: string;
  top: { title: string; value: number } | null;
  prevTop: { title: string; value: number } | null;
}): string {
  const diff = (o.cur - o.prev) / o.prev;
  const dir = o.cur >= o.prev ? "rose" : "fell";
  if (Math.abs(diff) < 0.3) return `${o.metric} ${dir} ${pct(Math.abs(diff))} from ${o.prevMonth} (${n(o.prev)} to ${n(o.cur)}).`;
  if (diff < 0 && o.prevTop && o.prevTop.value / o.prev >= 0.4)
    return `${o.metric} fell from ${n(o.prev)} to ${n(o.cur)}. ${o.prevMonth} was lifted by one ${o.unit}, "${shortTitle(o.prevTop.title)}", with ${n(o.prevTop.value)} ${o.metric.toLowerCase()}.`;
  if (diff > 0 && o.top && o.top.value / o.cur >= 0.4)
    return `${o.metric} rose from ${n(o.prev)} to ${n(o.cur)}, mostly thanks to "${shortTitle(o.top.title)}" with ${n(o.top.value)}.`;
  return `${o.metric} ${dir} ${pct(Math.abs(diff))} from ${o.prevMonth} (${n(o.prev)} to ${n(o.cur)}).`;
}

/**
 * Porsi + kata benda: "almost half of all visits", "about 1 in 5 users" (bentuk "1 in N" hanya untuk benda jamak
 * yang bisa dihitung, mis. users), selain itu persen: "20.8% of the total".
 */
export function shareOf(x: number, noun: string, countable = false): string {
  const w = shareWords(x);
  // persen di kalimat: bulat bila ≥ 10% ("36%"), 1 desimal bila kecil ("2.4%")
  if (!w || (w.includes(" in ") && !countable)) return `${pct(x, x >= 0.1 ? 0 : 1)} of ${noun}`;
  return w.includes(" in ") ? `${w} ${noun}` : `${w} of ${noun}`;
}

/** 1 → "one" (lebih wajar di kalimat), selain itu angka. */
export const count = (v: number) => (v === 1 ? "one" : n(v));

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
