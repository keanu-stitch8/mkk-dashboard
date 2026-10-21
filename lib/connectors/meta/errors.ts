// Error Graph API (Meta) → pesan Bahasa Indonesia yang bisa ditindaklanjuti. Murni, supaya bisa dites.

/** Izin yang dibutuhkan token system user (lihat README → Setup Connector → Meta). */
export const META_PERMISSIONS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "read_insights",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
] as const;

/** Error dari Graph API: `{ error: { message, type, code, error_subcode, is_transient, fbtrace_id } }`. */
export class GraphError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly subcode?: number,
    public readonly status?: number,
    public readonly transient?: boolean,
    public readonly fbtraceId?: string,
  ) {
    super(message);
    this.name = "GraphError";
  }

  /** Ringkasan untuk SyncLog.rawError (tanpa token). */
  toRaw(): string {
    return JSON.stringify({ message: this.message, code: this.code, subcode: this.subcode, status: this.status, fbtrace_id: this.fbtraceId });
  }
}

/** Rate limit (1/2/4/17/32/341/613, Business Use Case 80001–80014), error sementara, 5xx, atau jaringan. */
export function isRetryableMetaError(e: unknown): boolean {
  if (e instanceof GraphError) {
    if (e.transient) return true;
    if (e.code !== undefined && [1, 2, 4, 17, 32, 341, 613].includes(e.code)) return true;
    if (e.code !== undefined && e.code >= 80001 && e.code <= 80014) return true;
    return e.status !== undefined && e.status >= 500;
  }
  const m = String((e as Error)?.message ?? e);
  return /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(m);
}

/** Metrik insight ditolak (tidak didukung untuk media/post ini, atau sudah dicabut Meta). */
export const isInvalidMetricError = (e: unknown) => e instanceof GraphError && e.code === 100 && e.subcode !== 33 && /metric/i.test(e.message);

interface Ctx {
  pageId?: string;
  igUserId?: string;
}

export function metaErrorMessage(e: unknown, ctx: Ctx = {}): string {
  if (!(e instanceof GraphError)) {
    const m = String((e as Error)?.message ?? e);
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|getaddrinfo|network/i.test(m)) return "Can't reach the Meta server (graph.facebook.com). Check your internet connection and try again.";
    return `Failed to fetch data from the Meta Graph API: ${m}`;
  }
  const { code, subcode, message } = e;
  const ids = [ctx.pageId && `Page ${ctx.pageId}`, ctx.igUserId && `IG account ${ctx.igUserId}`].filter(Boolean).join(" / ") || "Page / IG account";

  if (code === 190 || code === 102) {
    if (subcode === 463) return "META_ACCESS_TOKEN has expired. Generate a new token in Business Settings → Users → System users → Generate new token (choose Token expiration: Never).";
    if (subcode === 460) return "META_ACCESS_TOKEN is no longer valid because the account password / session changed. Generate a new token from the system user.";
    return "META_ACCESS_TOKEN is invalid, expired, or revoked. Regenerate the system user token in Business Settings → Users → System users, then update .env.local.";
  }
  if (code === 803 || (code === 100 && subcode === 33)) {
    return `ID ${ids} wasn't found or isn't accessible with this token. Check META_PAGE_ID / META_IG_USER_ID, and make sure the Page & Instagram account are assigned to the system user (Business Settings → System users → Assign assets).`;
  }
  if (code === 10 || code === 3 || (code !== undefined && code >= 200 && code <= 299)) {
    return `The Meta token lacks permissions for ${ids}. Regenerate the system user token with: ${META_PERMISSIONS.join(", ")} — and make sure the Page & Instagram account are assigned to the system user (full access / "Manage" for the Page).`;
  }
  if (code === 368) return "Meta temporarily blocked the account / app for suspicious activity. Wait a while and try again.";
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 341 || (code !== undefined && code >= 80001 && code <= 80014)) {
    return "Meta Graph API rate limit reached. Try again in a few minutes (the limit is counted per hour).";
  }
  if (code === 1 || code === 2 || (e.status !== undefined && e.status >= 500)) return "Meta's servers are having problems. Try again later.";
  if (code === 100) return `Permintaan ditolak Meta Graph API: ${message}`;
  return `Failed to fetch data from the Meta Graph API: ${message}${code !== undefined ? ` (code ${code}${subcode ? `/${subcode}` : ""})` : ""}`;
}
