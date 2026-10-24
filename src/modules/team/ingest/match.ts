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

/** Status yang dibuat mesin — dihapus & dibuat ulang tiap rebuild; confirmed/rejected (keputusan tim) tidak pernah ditimpa. */
export const GENERATED_MATCH_STATUSES = ["coded", "auto", "tracker", "suggested"];

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
  /** satu target boleh dipakai banyak item (mis. beberapa IG story untuk satu artikel) */
  multiTo?: boolean;
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
  for (const side of opts.multiTo ? (["fromKey"] as const) : (["fromKey", "toKey"] as const)) {
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
    if (usedFrom.has(c.fromKey) || (!opts.multiTo && usedTo.has(c.toKey))) continue;
    usedFrom.add(c.fromKey);
    usedTo.add(c.toKey);
    out.push({ ...c, score: Math.round((c.score % 100) * 100) / 100 });
  }
  return out;
}

/** Catatan tim untuk satu item (Task Progress): status & tanggal tayang. */
export interface TrackerHint {
  status: string | null;
  published: string | null;
}

export type TrackedResult = Omit<MatchResult, "status"> & { status: MatchResult["status"] | "tracker" };

/**
 * Gabungkan hasil pencocokan judul dengan catatan tim. Tanggal di tracker bisa meleset sehari, jadi tanggal saja
 * tidak cukup — dua bukti harus sepakat:
 * - tracker "published" + pasangan judul (auto/suggested) tayang ±1 hari dari tanggalnya → "tracker" (dihitung)
 * - tracker "published" tapi judul tidak sepakat → semua jadi suggested, ditambah post format sama di ±1 hari itu
 * - tracker berstatus lain (reviewing, unpublished, …) tapi judul bilang auto → bertentangan, jadi suggested
 */
export function withTracker<F extends MatchItem, T extends MatchItem>(
  res: MatchResult[],
  from: F[],
  to: T[],
  hints: Map<string, TrackerHint>,
  opts: Pick<MatchOptions<F, T>, "compatible" | "rejected" | "takenTo">,
): TrackedResult[] {
  const toByKey = new Map(to.map((t) => [t.key, t]));
  const near = (a: string, b: string) => Math.abs(day(a) - day(b)) <= 1;
  const out: TrackedResult[] = res.map((m) => ({ ...m }));
  const claimed = () => new Set(out.filter((m) => m.status !== "suggested").map((m) => m.toKey));

  for (const f of from) {
    const hint = hints.get(f.key);
    if (!hint?.status) continue;
    const mine = out.filter((m) => m.fromKey === f.key);
    const pub = hint.status === "published" ? hint.published : null;
    const agree = pub ? mine.find((m) => near(toByKey.get(m.toKey)!.date, pub)) : undefined;
    if (agree) {
      agree.status = "tracker";
      // pasangan auto item lain ke post yang sama jadi diragukan
      for (const m of out) if (m !== agree && m.toKey === agree.toKey && m.status === "auto") m.status = "suggested";
      continue;
    }
    for (const m of mine) m.status = "suggested";
    if (!pub) continue;
    const taken = claimed();
    for (const t of to) {
      if (!near(t.date, pub) || taken.has(t.key) || opts.takenTo?.has(t.key) || opts.rejected?.has(`${f.key}→${t.key}`)) continue;
      if (opts.compatible && !opts.compatible(f, t)) continue;
      if (mine.some((m) => m.toKey === t.key)) continue;
      out.push({ fromKey: f.key, toKey: t.key, score: 0, status: "suggested" });
    }
  }
  return out;
}
