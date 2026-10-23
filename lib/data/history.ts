// Riwayat import & sync dikelompokkan per sesi. Tidak ada kolom sesi di DB, jadi sesi = baris berurutan
// yang jaraknya dekat (satu klik "Sync" / satu jalan cron menulis log & dataset beruntun). Murni, supaya bisa dites.

export interface Session<T> {
  /** waktu mulai sesi (baris paling awal) */
  start: Date;
  /** waktu selesai sesi (baris paling akhir) */
  end: Date;
  rows: T[];
}

/**
 * Kelompokkan baris (urut terbaru dulu) menjadi sesi. Baris masuk sesi yang sama jika `sameSession` terpenuhi
 * dan jedanya dari akhir baris sebelumnya ≤ `gapMs`. Urutan sesi & baris di dalamnya: terbaru dulu.
 */
export function groupSessions<T>(
  rows: T[],
  opts: { start: (r: T) => Date; end?: (r: T) => Date | null; gapMs: number; sameSession?: (a: T, b: T) => boolean },
): Session<T>[] {
  const end = (r: T) => opts.end?.(r) ?? opts.start(r);
  const asc = [...rows].sort((a, b) => opts.start(a).getTime() - opts.start(b).getTime());
  const sessions: Session<T>[] = [];
  for (const r of asc) {
    const cur = sessions.at(-1);
    const last = cur?.rows.at(-1);
    if (cur && last && opts.start(r).getTime() - cur.end.getTime() <= opts.gapMs && (opts.sameSession?.(last, r) ?? true)) {
      cur.rows.push(r);
      if (end(r) > cur.end) cur.end = end(r);
    } else {
      sessions.push({ start: opts.start(r), end: end(r), rows: [r] });
    }
  }
  return sessions.reverse().map((s) => ({ ...s, rows: s.rows.reverse() }));
}

/** Potong daftar untuk halaman `page` (1-based); halaman di luar jangkauan dijepit ke batas. */
export function paginate<T>(items: T[], page: number, perPage: number) {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((current - 1) * perPage, current * perPage), page: current, pages, total: items.length };
}

/** Nomor halaman untuk pager: selalu halaman pertama, terakhir, dan ±1 dari halaman aktif; `null` = elipsis. */
export function pageNumbers(page: number, pages: number): (number | null)[] {
  const keep = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const n of keep) {
    const prev = out.at(-1);
    if (prev != null && n - prev === 2) out.push(n - 1);
    else if (prev != null && n - prev > 2) out.push(null);
    out.push(n);
  }
  return out;
}
