import type { Dataset } from "../parsers/types";
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
