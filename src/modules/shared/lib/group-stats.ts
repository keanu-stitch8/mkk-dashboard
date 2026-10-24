export interface GroupStat {
  label: string;
  count: number;
  views: number;
  perContent: number | null;
}

/** Jumlah konten + views per kelompok (satu item boleh masuk beberapa kelompok), urut views terbanyak. */
export function groupStats<T>(items: T[], keys: (t: T) => string[], views: (t: T) => number | null): GroupStat[] {
  const map = new Map<string, GroupStat>();
  for (const it of items) {
    for (const k of keys(it)) {
      const g = map.get(k) ?? { label: k, count: 0, views: 0, perContent: null };
      g.count++;
      g.views += views(it) ?? 0;
      map.set(k, g);
    }
  }
  return [...map.values()]
    .map((g) => ({ ...g, perContent: g.count ? g.views / g.count : null }))
    .sort((a, b) => b.views - a.views || b.count - a.count);
}
