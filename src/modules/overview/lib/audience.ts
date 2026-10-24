import { prevMonth } from "@/modules/shared/lib/month";
import type { AudienceTotal } from "../types/audience";

export interface AudienceKeys {
  now: string;
  gained: string;
  lost: string;
}

/**
 * Total followers/subscriber per akhir bulan. API hanya memberi angka "saat ini", jadi disimpan sebagai snapshot
 * (metrik *Now) saat sync bulan berjalan; bulan sebelumnya = snapshot − Σ (gained − lost) bulan-bulan sesudahnya.
 */
export function audienceTotal(
  month: string,
  snap: { month: string; value: number } | null,
  flows: { month: string; key: string; value: number }[],
  keys: AudienceKeys,
): AudienceTotal {
  const flow = (m: string, key: string) => flows.find((f) => f.month === m && f.key === key)?.value ?? null;
  const gained = flow(month, keys.gained);
  const lost = flow(month, keys.lost);
  if (!snap || month > snap.month) return { value: null, estimated: false, gained, lost };
  let value: number | null = snap.value;
  for (let m = snap.month; m > month; m = prevMonth(m)) {
    const g = flow(m, keys.gained);
    const l = flow(m, keys.lost);
    if (g == null || l == null) {
      value = null;
      break;
    }
    value -= g - l;
  }
  return { value, estimated: month !== snap.month, gained, lost };
}
