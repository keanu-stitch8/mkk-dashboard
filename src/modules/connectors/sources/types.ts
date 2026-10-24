import type { Dataset } from "@/modules/import/parsers/types";
import type { ConnectorId } from "./catalog";

export interface EnvVar {
  name: string;
  required: boolean;
  hint: string;
}

export interface ConnectorStatus {
  configured: boolean;
  /** variabel env wajib yang belum diisi */
  missing: string[];
  /** info akun (mis. email service account, property ID) */
  account?: string;
  /** butuh OAuth (YouTube) dan sudah/belum terhubung */
  oauth?: { connected: boolean; account?: string; available?: boolean };
}

export interface TestResult {
  ok: boolean;
  message: string;
}

/** Interface seragam untuk semua connector. */
export interface Connector {
  id: ConnectorId;
  env: EnvVar[];
  status(): Promise<ConnectorStatus>;
  testConnection(): Promise<TestResult>;
  /** Ambil data satu bulan dalam bentuk Dataset yang sama dengan hasil parser CSV. */
  fetchMonth(month: string): Promise<Dataset[]>;
  /** Untuk connector yang menyimpan ke tabelnya sendiri (bukan dataset import); dipakai menggantikan fetchMonth. */
  syncMonth?(month: string): Promise<SyncOutput>;
}

export interface SyncOutput {
  rows: number;
  /** baris ringkasan untuk SyncLog.detail (awali "⚠ " untuk peringatan) */
  detail: string[];
}

/** Error dengan pesan Bahasa Indonesia yang siap ditampilkan ke user. */
export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly raw?: string,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}
