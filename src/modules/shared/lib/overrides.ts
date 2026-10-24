/** Isian form override → yang disimpan / dihapus. Key di luar `allowed` diabaikan; null / bukan angka = hapus. */
export function planOverrides(values: Record<string, number | null>, allowed: Set<string>, valid: (v: number) => boolean = () => true) {
  const set: [string, number][] = [];
  const clear: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) continue;
    if (value == null || !Number.isFinite(value) || !valid(value)) clear.push(key);
    else set.push([key, value]);
  }
  return { set, clear };
}
