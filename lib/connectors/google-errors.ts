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
    return `${info.name} belum diaktifkan di project Google Cloud. Aktifkan di https://console.cloud.google.com/apis/library/${info.library} lalu tunggu beberapa menit.`;
  }
  if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || m.includes("getaddrinfo") || m.includes("network")) {
    return "Tidak bisa terhubung ke server Google. Cek koneksi internet lalu coba lagi.";
  }
  if (m.includes("invalid_client") || m.includes("unauthorized_client")) {
    return "OAuth client ditolak Google: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET salah, atau OAuth client sudah dihapus di Google Cloud.";
  }
  if (code === 16 || status === 401 || m.includes("invalid_grant") || m.includes("unauthenticated") || m.includes("invalid jwt")) {
    if (oauth) {
      return "Akses akun Google sudah kedaluwarsa atau dicabut. Di halaman Connectors API, klik “Ganti akun” (atau “Hubungkan akun Google”) di kartu connector ini lalu login lagi. (Jika OAuth consent screen masih mode Testing, token kedaluwarsa tiap 7 hari — ubah ke In production.)";
    }
    return "Kunci service account ditolak (dihapus, kedaluwarsa, atau jam komputer tidak sinkron). Buat kunci JSON baru di Google Cloud → IAM → Service Accounts → Keys.";
  }
  if (code === 7 || status === 403 || m.includes("permission") || m.includes("insufficient")) {
    if (ctx.api === "ga4") {
      if (oauth) {
        return `Akun Google ${sa ? `${sa} ` : ""}tidak punya akses ke properti GA4${ctx.propertyId ? ` ${ctx.propertyId}` : ""}. Pastikan akun ini bisa membuka properti tersebut di analytics.google.com, atau cek GA4_PROPERTY_ID.`;
      }
      return `Service account belum ditambahkan ke properti GA4${ctx.propertyId ? ` ${ctx.propertyId}` : ""}. Tambahkan ${sa ?? "email service account"} sebagai Viewer di GA4 → Admin → Property access management.`;
    }
    if (ctx.api === "gsc") {
      if (oauth) return `Akun Google ${sa ? `${sa} ` : ""}tidak punya akses ke properti Search Console${ctx.siteUrl ? ` ${ctx.siteUrl}` : ""}.`;
      return `Service account belum punya akses ke properti Search Console${ctx.siteUrl ? ` ${ctx.siteUrl}` : ""}. Tambahkan ${sa ?? "email service account"} sebagai user (Restricted cukup) di Search Console → Settings → Users and permissions.`;
    }
    if (ctx.api === "sheets") return "Akses Google Drive ditolak. Hubungkan ulang akun Google di kartu Google Sheets dan centang izin “Lihat semua file Google Drive”.";
    return "Akses ditolak oleh Google. Hubungkan ulang akun YouTube dan pastikan memilih akun pemilik channel.";
  }
  if (code === 5 || status === 404 || (code === 3 && m.includes("property"))) {
    if (ctx.api === "ga4") return `Properti GA4 "${ctx.propertyId ?? "?"}" tidak ditemukan. Pakai angka Property ID dari GA4 → Admin → Property details (bukan Measurement ID G-XXXX).`;
    if (ctx.api === "gsc") return `Properti Search Console "${ctx.siteUrl ?? "?"}" tidak ditemukan. Gunakan format persis seperti di Search Console, mis. "sc-domain:mainkekudus.com" atau "https://mainkekudus.com/".`;
  }
  if (code === 8 || status === 429 || m.includes("quota") || m.includes("rate limit") || m.includes("resource_exhausted")) {
    return `Kuota ${info.name} habis untuk sementara. Coba lagi beberapa menit lagi (atau besok jika kuota harian).`;
  }
  if (code === 3 || status === 400) return `Permintaan ditolak ${info.name}: ${message}`;
  if (code === 14 || (typeof status === "number" && status >= 500)) return `Server ${info.name} sedang bermasalah. Coba lagi nanti.`;
  return `Gagal mengambil data dari ${info.name}: ${message}`;
}

/** Error sementara yang layak di-retry. */
export function isRetryableGoogleError(e: unknown): boolean {
  const { code, status, message } = parts(e);
  if (code === 8 || code === 14 || code === 4 || status === 429 || (typeof status === "number" && status >= 500)) return true;
  return /ECONNRESET|ETIMEDOUT|socket hang up/i.test(message);
}
