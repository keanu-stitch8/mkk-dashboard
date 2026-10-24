export interface ConnectorCard {
  id: string;
  label: string;
  description: string;
  fills: string;
  /** ready = kredensial lengkap, missing = belum dikonfigurasi, soon = belum dibuat */
  state: "ready" | "missing" | "soon";
  /** connector sudah dibuat (tombol Test connection + daftar env tampil) */
  implemented: boolean;
  configured: boolean;
  env: { name: string; hint: string; filled: boolean }[];
  account: string | null;
  oauth: { connected: boolean; account: string | null; available: boolean } | null;
  /** service account aktif dan didahulukan daripada akun Google (OAuth) */
  serviceAccountActive: boolean;
  lastSync: { at: Date; month: string; ok: boolean } | null;
}

export interface MonthLockRow {
  month: string;
  lock: { lockedAt: Date; note: string | null } | null;
  /** bulan berjalan / mendatang tidak bisa dikunci */
  current: boolean;
}

export interface ConnectorSettings {
  cards: ConnectorCard[];
  configured: string[];
  lockRows: MonthLockRow[];
  currentMonth: string;
  /** bulan default tombol Sync (bulan penuh terakhir) */
  defaultSyncMonth: string;
}
