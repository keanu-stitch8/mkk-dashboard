// Helper bersama untuk connector API.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Dataset, DatasetKey } from "@/modules/import/parsers/types";
import { ConnectorError } from "./types";
import { WIB, dateIn } from "@/modules/shared/lib/tz";

/**
 * Rentang tanggal satu bulan; bulan berjalan dipotong sampai hari ini, bulan depan ditolak.
 * `tz` = zona hari laporan API (default WIB; YouTube & GSC = Pacific, GA4 = zona properti).
 */
export function monthRange(month: string, today = new Date(), tz = WIB): { start: string; end: string; partial: boolean } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ConnectorError(`Invalid month format: "${month}" (use YYYY-MM).`);
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const last = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const todayLocal = dateIn(today, tz);
  if (start > todayLocal) throw new ConnectorError(`${month} hasn't started yet — no data to pull.`);
  return last > todayLocal ? { start, end: todayLocal, partial: true } : { start, end: last, partial: false };
}

/** Dataset dari API dengan bentuk yang sama seperti hasil parser CSV. */
export function apiDataset(key: DatasetKey, source: string, month: string, init: Partial<Dataset>): Dataset {
  return {
    key,
    file: source,
    month,
    range: null,
    rowDated: false,
    priority: 0,
    columns: [],
    unmatched: [],
    rows: [],
    metrics: [],
    breakdowns: [],
    warnings: [],
    ...init,
  };
}

export const num = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Baca JSON kunci service account dari GOOGLE_APPLICATION_CREDENTIALS. */
export function serviceAccountKey(): { path: string; clientEmail: string; projectId?: string } {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!p) throw new ConnectorError("GOOGLE_APPLICATION_CREDENTIALS isn't set in .env.local (path to the service account JSON key file).");
  const path = resolve(p);
  if (!existsSync(path)) throw new ConnectorError(`Service account key file not found: ${path}`);
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as { client_email?: string; project_id?: string; type?: string };
    if (json.type !== "service_account" || !json.client_email) throw new Error("not a service account");
    return { path, clientEmail: json.client_email, projectId: json.project_id };
  } catch {
    throw new ConnectorError(`File ${path} isn't a valid service account JSON key. Download it again from Google Cloud → IAM → Service Accounts → Keys.`);
  }
}

/** Retry dengan exponential backoff untuk error sementara (rate limit / 5xx / jaringan). */
export async function withRetry<T>(fn: () => Promise<T>, isRetryable: (e: unknown) => boolean, attempts = 4): Promise<T> {
  let delay = 1000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isRetryable(e)) throw e;
      await new Promise((r) => setTimeout(r, delay + Math.random() * 250));
      delay *= 2;
    }
  }
}
