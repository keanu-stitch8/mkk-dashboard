export interface AudienceTotal {
  /** total per akhir bulan (bulan berjalan: per tanggal sync terakhir) */
  value: number | null;
  /** true = dihitung mundur dari snapshot bulan sesudahnya (estimasi) */
  estimated: boolean;
  gained: number | null;
  lost: number | null;
}

/** Kartu audiens Overview (semua kumulatif). */
export interface Audience {
  /** pembaca website unik GA4 sejak awal data */
  cumulativeUsers: number | null;
  returningUsers: number | null;
  websiteUsers: number | null;
  instagram: AudienceTotal;
  youtube: AudienceTotal;
}
