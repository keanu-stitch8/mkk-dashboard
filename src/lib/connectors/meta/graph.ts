// Client tipis Graph API (fetch bawaan Node): retry + backoff, paginasi `paging.next`, insights dengan fallback per metrik.
import { createHmac } from "node:crypto";
import { withRetry } from "../common";
import { GraphError, isInvalidMetricError, isRetryableMetaError } from "./errors";
import { insightValues, type InsightsResponse } from "./map";

/** Versi Graph API — satu-satunya tempat versi ditulis. v26.0 dirilis 29 Juli 2026. */
export const GRAPH_VERSION = "v26.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface Paged<T> {
  data?: T[];
  paging?: { next?: string };
}

type Params = Record<string, string | number | undefined>;

/** GET ke Graph API. `path` boleh relatif ("/me") atau URL `paging.next` lengkap. */
export async function graphGet<T>(path: string, token: string, params: Params = {}): Promise<T> {
  const url = new URL(path.startsWith("https://") ? path : `${GRAPH_URL}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  url.searchParams.set("access_token", token);
  // Wajib jika app mengaktifkan "Require App Secret" (Advanced settings app Meta).
  const secret = process.env.META_APP_SECRET?.trim();
  if (secret) url.searchParams.set("appsecret_proof", createHmac("sha256", secret).update(token).digest("hex"));

  return withRetry(async () => {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    const body = (await res.json().catch(() => null)) as
      | (T & { error?: { message?: string; code?: number; error_subcode?: number; is_transient?: boolean; fbtrace_id?: string } })
      | null;
    if (!res.ok || body?.error) {
      const err = body?.error;
      throw new GraphError(err?.message ?? `HTTP ${res.status}`, err?.code, err?.error_subcode, res.status, err?.is_transient, err?.fbtrace_id);
    }
    return body as T;
  }, isRetryableMetaError);
}

/**
 * Ikuti `paging.next` sampai habis, atau berhenti setelah halaman yang item terakhirnya memenuhi `stop`
 * (data urut terbaru dulu). Dicek di item terakhir, bukan per item, supaya post lama yang di-pin di atas
 * tidak menghentikan paginasi terlalu dini. Filter rentang tetap dilakukan pemanggil.
 */
export async function graphPaginate<T>(path: string, token: string, params: Params, stop?: (item: T) => boolean, maxPages = 50): Promise<T[]> {
  const out: T[] = [];
  let page = await graphGet<Paged<T>>(path, token, params);
  for (let i = 1; ; i++) {
    const items = page.data ?? [];
    out.push(...items);
    if (!page.paging?.next || !items.length || i >= maxPages || (stop && stop(items[items.length - 1]))) return out;
    page = await graphGet<Paged<T>>(page.paging.next, token);
  }
}

/**
 * /{id}/insights untuk sekumpulan metrik. Kalau Meta menolak salah satu metrik (kode 100 — tidak didukung
 * untuk jenis konten ini atau sudah dicabut), metrik diminta satu per satu; yang ditolak dicatat di `rejected`.
 */
export async function graphInsights(id: string, token: string, metrics: string[], params: Params = {}): Promise<{ values: Record<string, number>; rejected: string[] }> {
  try {
    const res = await graphGet<InsightsResponse>(`/${id}/insights`, token, { metric: metrics.join(","), ...params });
    return { values: insightValues(res), rejected: [] };
  } catch (e) {
    if (!isInvalidMetricError(e)) throw e;
    if (metrics.length === 1) return { values: {}, rejected: metrics };
  }
  const values: Record<string, number> = {};
  const rejected: string[] = [];
  for (const m of metrics) {
    try {
      Object.assign(values, insightValues(await graphGet<InsightsResponse>(`/${id}/insights`, token, { metric: m, ...params })));
    } catch (e) {
      if (!isInvalidMetricError(e)) throw e;
      rejected.push(m);
    }
  }
  return { values, rejected };
}

/** Jalankan `fn` untuk tiap item dengan paralelisme terbatas (ramah rate limit). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
