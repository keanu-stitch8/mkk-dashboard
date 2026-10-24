// Pencocokan Publishing Log ↔ post Instagram dan cek konsistensinya (murni, tanpa DB).

export interface SocialReconOf<P, L> {
  byFormat: { format: string; log: number; api: number; diff: number; detail: { format: string; count: number }[] }[];
  /** post IG tanpa baris log */
  notInLog: P[];
  /** baris log berplatform IG yang tidak ditemukan di IG */
  logNotOnIg: L[];
  /** log & post kemungkinan konten yang sama tapi format berbeda (Feeds vs Reels) */
  formatMismatch: { post: P; log: L }[];
  /** Video di log yang tayang sebagai Reels di IG — wajar, hanya info */
  videoAsReels: { post: P; log: L }[];
  /** konten di log yang tidak diposting ke IG (TikTok/YouTube saja) — tetap dihitung ke kuota */
  offInstagram: L[];
  /** baris log kembar: tanggal, format & judul sama */
  duplicates: L[][];
  /** baris log IG tanpa URL (dicocokkan lewat judul + tanggal) */
  missingUrl: number;
}

/** Kategori untuk post Meta yang tidak punya pasangan di publishing log. */
export const NOT_IN_LOG_LABEL = "(not in the Publishing Log)";

const STOPWORDS = new Set(["yang", "dari", "dengan", "untuk", "kudus", "main", "mainkekudus", "kamu", "jangan", "sudah", "dalam", "pada", "juga", "lebih", "hanya", "bukan", "para", "atau", "akan", "this", "the"]);
const words = (s: string | null | undefined) =>
  new Set(
    (s ?? "")
      .toLowerCase()
      .replace(/#\S+/g, " ")
      .normalize("NFKD")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );

export type LogRow = { id: string; date: string | null; platform: string; format: string; status: string; title: string | null; url: string | null; category: string | null };
export type PostRow = { id: string; date: string; platform: string; format: string; caption: string | null; permalink: string | null };

/**
 * Cocokkan baris publishing log ke post Meta (1:1).
 * Urutan: URL sama (IG: shortcode) → skor terbaik (kemiripan judul vs caption, lalu selisih tanggal ≤3 hari),
 * dipilih global dari skor tertinggi supaya pasangan tidak saling "mencuri".
 */
export function matchLogsToPosts<P extends PostRow, L extends LogRow>(posts: P[], logs: L[]): Map<string, L> {
  const out = new Map<string, L>();
  const usedLogs = new Set<string>();
  // IG: bandingkan shortcode (log sering pakai /p/ untuk Reels yang permalink-nya /reel/; shortcode peka huruf besar/kecil)
  const clean = (u: string) => {
    const ig = u.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/i);
    return ig ? `ig:${ig[1]}` : u.trim().split("?")[0].trim().replace(/\/$/, "").toLowerCase();
  };
  for (const p of posts) {
    const l = logs.find((x) => !usedLogs.has(x.id) && x.url && p.permalink && clean(x.url) === clean(p.permalink));
    if (l) {
      out.set(p.id, l);
      usedLogs.add(l.id);
    }
  }
  const compatible = (lf: string, pf: string) =>
    lf === pf || (["feeds", "carousel", "photo"].includes(lf) && ["feeds", "carousel", "photo"].includes(pf)) || (["reels", "shorts", "video"].includes(lf) && ["reels", "video"].includes(pf));
  const cands: { post: P; log: L; score: number }[] = [];
  for (const p of posts) {
    if (out.has(p.id)) continue;
    const pw = words(p.caption);
    for (const l of logs) {
      if (usedLogs.has(l.id) || l.status !== "publish" || !l.date) continue;
      if (!l.platform.split(",").includes(p.platform) || !compatible(l.format, p.format)) continue;
      const diff = Math.abs(Date.parse(l.date) - Date.parse(p.date)) / 86400000;
      if (diff > 3) continue;
      const overlap = [...words(l.title)].filter((w) => pw.has(w)).length;
      cands.push({ post: p, log: l, score: overlap * 10 - diff });
    }
  }
  // tanpa kata yang sama, hanya terima jika tanggalnya persis sama
  for (const c of maxMatching(cands.filter((c) => c.score >= 0))) out.set(c.post.id, c.log);
  return out;
}

/**
 * Pasangan sebanyak mungkin, lalu total skor tertinggi (successive shortest path / min-cost matching).
 * Greedy skor tertinggi bisa memakai 1 pasangan (log A→post B) sehingga 2 pasangan valid hilang (A↔A & B↔B).
 */
function maxMatching<E extends { post: { id: string }; log: { id: string }; score: number }>(edges: E[]): E[] {
  const byPost = new Map<string, E>();
  const byLog = new Map<string, E>();
  const posts = [...new Set(edges.map((e) => e.post.id))];
  for (;;) {
    // Bellman-Ford di graf residual: post→log (belum dipasang) biaya -skor, log→post (sudah dipasang) biaya +skor
    const dist = new Map<string, number>();
    const via = new Map<string, E>();
    for (const p of posts) if (!byPost.has(p)) dist.set(`p:${p}`, 0);
    for (let changed = true, i = 0; changed && i <= 2 * edges.length; i++) {
      changed = false;
      for (const e of edges) {
        const [from, to, cost] = byPost.get(e.post.id) === e ? [`l:${e.log.id}`, `p:${e.post.id}`, e.score] : [`p:${e.post.id}`, `l:${e.log.id}`, -e.score];
        const d = dist.get(from);
        if (d != null && d + cost < (dist.get(to) ?? Infinity)) {
          dist.set(to, d + cost);
          via.set(to, e);
          changed = true;
        }
      }
    }
    let end: string | null = null;
    for (const e of edges) {
      const k = `l:${e.log.id}`;
      if (!byLog.has(e.log.id) && dist.has(k) && (end == null || dist.get(k)! < dist.get(end)!)) end = k;
    }
    if (!end) return [...byPost.values()];
    // balik jalur dari log bebas: edge maju jadi pasangan; post-nya melepas pasangan lama (via[post]) ke log sebelumnya
    for (let node: string | null = end; node; ) {
      const e = via.get(node)!;
      const prev = via.get(`p:${e.post.id}`);
      byPost.set(e.post.id, e);
      byLog.set(e.log.id, e);
      node = prev ? `l:${prev.log.id}` : null;
    }
  }
}

/** Format dalam istilah Instagram: video apa pun tayang sebagai Reels, carousel/foto = Feeds. */
const igFormat = (f: string) => (["reels", "video", "shorts"].includes(f) ? "reels" : ["feeds", "carousel", "photo"].includes(f) ? "feeds" : f);
const onInstagram = (l: LogRow) => l.platform.split(",").includes("instagram");

/**
 * Cek konsistensi Publishing Log vs post Instagram dari API (hanya log berstatus publish, tanpa Stories —
 * API tidak memberi Stories lama). Semua daftar berisi baris log / post asli untuk ditindaklanjuti.
 */
export function reconcileSocial<P extends PostRow, L extends LogRow>(posts: P[], logs: L[], matched: Map<string, L>): SocialReconOf<P, L> {
  const content = logs.filter((l) => l.status === "publish" && l.format !== "story");
  const igLogs = content.filter(onInstagram);
  const matchedLogIds = new Set([...matched.values()].map((l) => l.id));
  const pairs = posts.flatMap((p) => (matched.has(p.id) ? [{ post: p, log: matched.get(p.id)! }] : []));

  // Log & post sama-sama tanpa pasangan, tanggal ±1 hari, judul mirip (atau tanggal sama) → kemungkinan format di log salah
  let freePosts = posts.filter((p) => !matched.has(p.id));
  let freeLogs = igLogs.filter((l) => !matchedLogIds.has(l.id));
  const formatMismatch = pairs.filter((x) => igFormat(x.log.format) !== igFormat(x.post.format));
  for (const l of [...freeLogs]) {
    const best = freePosts
      .map((p) => ({ p, diff: l.date ? Math.abs(Date.parse(l.date) - Date.parse(p.date)) / 86400000 : Infinity, overlap: [...words(l.title)].filter((w) => words(p.caption).has(w)).length }))
      .filter((x) => x.diff <= 1 && (x.overlap > 0 || x.diff === 0))
      .sort((a, b) => b.overlap - a.overlap || a.diff - b.diff)[0];
    if (!best) continue;
    formatMismatch.push({ post: best.p, log: l });
    freePosts = freePosts.filter((p) => p !== best.p);
    freeLogs = freeLogs.filter((x) => x !== l);
  }

  // Ringkasan per format IG: log (platform termasuk IG) vs API
  const byFormat = ["reels", "feeds"].map((f) => {
    const logRows = igLogs.filter((l) => igFormat(l.format) === f);
    const detail = Object.entries(logRows.reduce<Record<string, number>>((a, l) => ((a[l.format] = (a[l.format] ?? 0) + 1), a), {})).map(([format, count]) => ({ format, count }));
    const log = logRows.length;
    const api = posts.filter((p) => igFormat(p.format) === f).length;
    return { format: f, log, api, diff: api - log, detail };
  });

  const titleKey = (l: L) => `${l.date}|${l.format}|${(l.title ?? "").trim().toLowerCase()}`;
  const groups = new Map<string, L[]>();
  for (const l of content) groups.set(titleKey(l), [...(groups.get(titleKey(l)) ?? []), l]);

  return {
    byFormat,
    /** post IG tanpa baris log */
    notInLog: freePosts,
    /** baris log berplatform IG yang tidak ditemukan di IG */
    logNotOnIg: freeLogs,
    /** log & post kemungkinan konten yang sama tapi format berbeda (Feeds vs Reels) */
    formatMismatch,
    /** Video di log yang tayang sebagai Reels di IG — wajar, hanya info */
    videoAsReels: pairs.filter((x) => ["video", "shorts"].includes(x.log.format) && x.post.format === "reels"),
    /** konten di log yang tidak diposting ke IG (TikTok/YouTube saja) — tetap dihitung ke kuota */
    offInstagram: content.filter((l) => !onInstagram(l)),
    /** baris log kembar: tanggal, format & judul sama */
    duplicates: [...groups.values()].filter((g) => g.length > 1 && g[0].title),
    /** baris log IG tanpa URL (dicocokkan lewat judul + tanggal) */
    missingUrl: igLogs.filter((l) => !l.url).length,
  };
}
