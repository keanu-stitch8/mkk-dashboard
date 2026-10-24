// Terjemahan error Google API (gRPC GA4 / REST googleapis) ke pesan Bahasa Indonesia yang bisa ditindaklanjuti.

type Api = "ga4" | "gsc" | "youtube" | "sheets";

const API_INFO: Record<Api, { name: string; library: string }> = {
  ga4: { name: "Google Analytics Data API", library: "analyticsdata.googleapis.com" },
  gsc: { name: "Google Search Console API", library: "searchconsole.googleapis.com" },
  youtube: { name: "YouTube Analytics API / YouTube Data API v3", library: "youtubeanalytics.googleapis.com" },
  sheets: { name: "Google Drive API", library: "drive.googleapis.com" },
};

interface Ctx {
  api: Api;
  /** service_account (default) atau oauth (akun Google pengguna) */
  authMode?: "service_account" | "oauth";
  /** email akun yang dipakai (service account atau akun Google) */
  account?: string;
  serviceAccount?: string;
  propertyId?: string;
  siteUrl?: string;
}

function parts(e: unknown): { code?: number | string; status?: number; message: string } {
  const err = e as { code?: number | string; status?: number; response?: { status?: number }; message?: string; details?: string };
  return {
    code: err?.code,
    status: err?.status ?? err?.response?.status,
    message: [err?.message, err?.details].filter(Boolean).join(" · ") || String(e),
  };
}

export function googleErrorMessage(e: unknown, ctx: Ctx): string {
  const { code, status, message } = parts(e);
  const m = message.toLowerCase();
  const info = API_INFO[ctx.api];
  const oauth = ctx.authMode === "oauth";
  const sa = ctx.account ?? ctx.serviceAccount;

  if (m.includes("has not been used in project") || m.includes("service_disabled") || m.includes("is disabled")) {
    return `${info.name} isn't enabled in the Google Cloud project. Enable it at https://console.cloud.google.com/apis/library/${info.library} and wait a few minutes.`;
  }
  if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || m.includes("getaddrinfo") || m.includes("network")) {
    return "Can't reach Google's servers. Check your internet connection and try again.";
  }
  if (m.includes("invalid_client") || m.includes("unauthorized_client")) {
    return "Google rejected the OAuth client: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET is wrong, or the OAuth client was deleted in Google Cloud.";
  }
  if (code === 16 || status === 401 || m.includes("invalid_grant") || m.includes("unauthenticated") || m.includes("invalid jwt")) {
    if (oauth) {
      return "Google account access expired or was revoked. On the Connectors API page, click “Switch account” (or “Connect Google account”) on this connector's card and sign in again. (If the OAuth consent screen is still in Testing mode, tokens expire every 7 days — switch it to In production.)";
    }
    return "The service account key was rejected (deleted, expired, or the computer clock is out of sync). Create a new JSON key in Google Cloud → IAM → Service Accounts → Keys.";
  }
  if (code === 7 || status === 403 || m.includes("permission") || m.includes("insufficient")) {
    if (ctx.api === "ga4") {
      if (oauth) {
        return `Google account ${sa ? `${sa} ` : ""}has no access to GA4 property${ctx.propertyId ? ` ${ctx.propertyId}` : ""}. Make sure this account can open the property at analytics.google.com, or check GA4_PROPERTY_ID.`;
      }
      return `The service account hasn't been added to GA4 property${ctx.propertyId ? ` ${ctx.propertyId}` : ""}. Add ${sa ?? "the service account email"} as a Viewer in GA4 → Admin → Property access management.`;
    }
    if (ctx.api === "gsc") {
      if (oauth) return `Google account ${sa ? `${sa} ` : ""}has no access to Search Console property${ctx.siteUrl ? ` ${ctx.siteUrl}` : ""}.`;
      return `The service account has no access to Search Console property${ctx.siteUrl ? ` ${ctx.siteUrl}` : ""} yet. Add ${sa ?? "the service account email"} as a user (Restricted is enough) in Search Console → Settings → Users and permissions.`;
    }
    if (ctx.api === "sheets") return "Google Drive access denied. Reconnect the Google account on the Google Sheets card and tick the “See all your Google Drive files” permission.";
    return "Google denied access. Reconnect the YouTube account and make sure to pick the channel owner's account.";
  }
  if (code === 5 || status === 404 || (code === 3 && m.includes("property"))) {
    if (ctx.api === "ga4") return `GA4 property "${ctx.propertyId ?? "?"}" not found. Use the numeric Property ID from GA4 → Admin → Property details (not the G-XXXX Measurement ID).`;
    if (ctx.api === "gsc") return `Search Console property "${ctx.siteUrl ?? "?"}" not found. Use the exact format shown in Search Console, e.g. "sc-domain:mainkekudus.com" or "https://mainkekudus.com/".`;
  }
  if (code === 8 || status === 429 || m.includes("quota") || m.includes("rate limit") || m.includes("resource_exhausted")) {
    return `${info.name} quota is temporarily exhausted. Try again in a few minutes (or tomorrow for a daily quota).`;
  }
  if (code === 3 || status === 400) return `Permintaan ditolak ${info.name}: ${message}`;
  if (code === 14 || (typeof status === "number" && status >= 500)) return `${info.name} servers are having problems. Try again later.`;
  return `Failed to fetch data from ${info.name}: ${message}`;
}

/** Error sementara yang layak di-retry. */
export function isRetryableGoogleError(e: unknown): boolean {
  const { code, status, message } = parts(e);
  if (code === 8 || code === 14 || code === 4 || status === 429 || (typeof status === "number" && status >= 500)) return true;
  return /ECONNRESET|ETIMEDOUT|socket hang up/i.test(message);
}
