// Pencocokan antar tahap (panduan → artikel, brief → post IG / artikel) dari kemiripan judul. Murni, supaya bisa dites.
//
// Aturan status (diputuskan bersama tim: yang ambigu TIDAK boleh dianggap benar):
//   auto      = ≥3 kata sama, ≥60% judul terpendek, dan ≥2 kata itu jarang (muncul di ≤3 judul target).
//               Kata nama event (hydroplus, djarum, milklife…) muncul di banyak judul, jadi tidak cukup sendirian.
//   suggested = lolos syarat dasar (≥2 kata, ≥40%) atau baru cocok setelah teks tambahan (angle) ikut dibandingkan.
//               Hanya saran: tidak dihitung sebagai "sudah tayang" sampai dikonfirmasi.
//               Auto juga turun jadi suggested jika ada kandidat auto lain yang hampir sama kuat untuk item yang sama.

const STOP = new Set(
  "di dan yang ke dari untuk dengan jadi lewat para bagi hingga sebagai the of a ini itu pada dalam juga akan kota cara menjadi warga kudus 2026 ala si sang kini tak bisa ada atau oleh saat se yg serta lebih makin baru".split(
    " ",
  ),
);

export function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

export interface MatchItem {
  key: string;
  /** YYYY-MM-DD */
  date: string;
  /** judul utama yang dibandingkan */
  text: string;
  /** teks tambahan (mis. angle panduan) — hanya bisa menghasilkan "suggested" */
  extra?: string | null;
  format?: string | null;
}

export interface MatchOptions<F extends MatchItem, T extends MatchItem> {
  /** target harus tayang di antara date+minDays … date+maxDays */
  minDays: number;
  maxDays: number;
  compatible?: (from: F, to: T) => boolean;
  /** pasangan "fromKey→toKey" yang sudah ditolak tim */
  rejected?: Set<string>;
  /** from / to yang sudah punya pasangan terkonfirmasi (tidak dicocokkan lagi) */
  takenFrom?: Set<string>;
  takenTo?: Set<string>;
}

export interface MatchResult {
  fromKey: string;
  toKey: string;
  score: number;
  status: "auto" | "suggested";
}

const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 864e5;

/** Pasangan satu-ke-satu terbaik (greedy, skor tertinggi dulu; auto selalu didahulukan dari suggested). */
export function matchItems<F extends MatchItem, T extends MatchItem>(from: F[], to: T[], opts: MatchOptions<F, T>): MatchResult[] {
  const df = new Map<string, number>();
  const toTok = to.map((t) => tokens(t.text));
  for (const ts of toTok) for (const w of ts) df.set(w, (df.get(w) ?? 0) + 1);

  const cands: MatchResult[] = [];
  for (const f of from) {
    if (opts.takenFrom?.has(f.key)) continue;
    const A = tokens(f.text);
    const AX = f.extra ? tokens(`${f.text} ${f.extra}`) : null;
    if (!A.size) continue;
    to.forEach((t, j) => {
      if (opts.takenTo?.has(t.key) || opts.rejected?.has(`${f.key}→${t.key}`)) return;
      const lag = day(t.date) - day(f.date);
      if (!(lag >= opts.minDays && lag <= opts.maxDays)) return;
      if (opts.compatible && !opts.compatible(f, t)) return;
      const B = toTok[j];
      if (!B.size) return;
      const common = [...B].filter((w) => A.has(w));
      const sim = common.length / Math.min(A.size, B.size);
      const rare = common.filter((w) => (df.get(w) ?? 0) <= 3).length;
      if (common.length >= 3 && sim >= 0.6 && rare >= 2) cands.push({ fromKey: f.key, toKey: t.key, score: 100 + common.length + sim, status: "auto" });
      else if (common.length >= 2 && sim >= 0.4) cands.push({ fromKey: f.key, toKey: t.key, score: common.length + sim, status: "suggested" });
      else if (AX) {
        const cx = [...B].filter((w) => AX.has(w)).length;
        if (cx >= 3 && cx / Math.min(A.size, B.size) >= 0.4) cands.push({ fromKey: f.key, toKey: t.key, score: cx / 2, status: "suggested" });
      }
    });
  }
  // dua kandidat auto yang sama kuat untuk satu item (mis. dua artikel dari event yang sama) = ambigu → suggested
  for (const side of ["fromKey", "toKey"] as const) {
    const groups = new Map<string, MatchResult[]>();
    for (const c of cands) if (c.status === "auto") groups.set(c[side], [...(groups.get(c[side]) ?? []), c]);
    for (const g of groups.values()) {
      g.sort((a, b) => b.score - a.score);
      if (g.length >= 2 && g[0].score - g[1].score < 1) for (const c of g) Object.assign(c, { status: "suggested", score: c.score - 100 });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();
  const out: MatchResult[] = [];
  for (const c of cands) {
    if (usedFrom.has(c.fromKey) || usedTo.has(c.toKey)) continue;
    usedFrom.add(c.fromKey);
    usedTo.add(c.toKey);
    out.push({ ...c, score: Math.round((c.score % 100) * 100) / 100 });
  }
  return out;
}
