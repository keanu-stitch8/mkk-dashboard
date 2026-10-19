// OAuth Google (akun pengguna) untuk connector yang tidak memakai service account:
// GA4 / GSC (jika tidak punya akses admin untuk menambah service account) dan YouTube.
// Refresh token disimpan terenkripsi (AES-256-GCM) di tabel ConnectorCredential.
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db";
import { decrypt, encrypt } from "../crypto";
import { ConnectorError } from "./types";
import type { ConnectorId } from "./catalog";

export type GoogleOAuthConnector = Extract<ConnectorId, "ga4" | "gsc" | "youtube" | "sheets">;

/** Scope minimal (read-only) per connector. */
export const GOOGLE_SCOPES: Record<GoogleOAuthConnector, string[]> = {
  ga4: ["https://www.googleapis.com/auth/analytics.readonly"],
  gsc: ["https://www.googleapis.com/auth/webmasters.readonly"],
  youtube: ["https://www.googleapis.com/auth/yt-analytics.readonly", "https://www.googleapis.com/auth/youtube.readonly"],
  // drive.readonly: cari file by nama + export ke XLSX (Publishing Log).
  // drive.file: buat & edit file milik app ini (laporan hasil generate) — tidak bisa menyentuh file user lain.
  sheets: ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/drive.file"],
};

/** Connector yang hanya bisa lewat login akun Google (service account tidak punya akses ke file/channel milik akun). */
export const OAUTH_ONLY: GoogleOAuthConnector[] = ["youtube", "sheets"];
const IDENTITY_SCOPES = ["openid", "email"];

export const isGoogleOAuthConnector = (id: string): id is GoogleOAuthConnector => id in GOOGLE_SCOPES;

export function oauthClientConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());
}

/** Redirect URI harus terdaftar persis di OAuth client Google Cloud. */
export function redirectUri(origin?: string): string {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || `${origin ?? "http://localhost:3000"}/api/auth/google/callback`;
}

function client(origin?: string): OAuth2Client {
  if (!oauthClientConfigured()) {
    throw new ConnectorError("GOOGLE_OAUTH_CLIENT_ID dan GOOGLE_OAUTH_CLIENT_SECRET belum diisi di .env.local (OAuth client tipe Web application di Google Cloud).");
  }
  return new OAuth2Client({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
    redirectUri: redirectUri(origin),
  });
}

/** URL halaman consent Google (offline access → dapat refresh token). */
export function authUrl(connector: GoogleOAuthConnector, state: string, origin?: string): string {
  return client(origin).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_SCOPES[connector], ...IDENTITY_SCOPES],
    include_granted_scopes: false,
    state,
  });
}

interface StoredToken {
  refresh_token: string;
  scope: string;
  email?: string;
}

/** Tukar authorization code → simpan refresh token terenkripsi. Mengembalikan email akun. */
export async function completeOAuth(connector: GoogleOAuthConnector, code: string, origin?: string): Promise<string | undefined> {
  const c = client(origin);
  const { tokens } = await c.getToken(code);
  if (!tokens.refresh_token) {
    throw new ConnectorError("Google tidak mengirim refresh token. Cabut akses aplikasi di https://myaccount.google.com/permissions lalu hubungkan ulang.");
  }
  const granted = (tokens.scope ?? "").split(/\s+/);
  const missing = GOOGLE_SCOPES[connector].filter((s) => !granted.includes(s));
  if (missing.length) {
    throw new ConnectorError("Izin yang dibutuhkan tidak dicentang di halaman consent Google. Hubungkan ulang dan centang semua izin yang diminta.");
  }
  let email: string | undefined;
  if (tokens.id_token) {
    const ticket = await c.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim() });
    email = ticket.getPayload()?.email;
  }
  const data: StoredToken = { refresh_token: tokens.refresh_token, scope: tokens.scope ?? "", email };
  await prisma.connectorCredential.upsert({
    where: { connector },
    update: { data: encrypt(JSON.stringify(data)), account: email ?? null },
    create: { connector, data: encrypt(JSON.stringify(data)), account: email ?? null },
  });
  return email;
}

export async function oauthAccount(connector: GoogleOAuthConnector): Promise<{ connected: boolean; account?: string }> {
  const row = await prisma.connectorCredential.findUnique({ where: { connector } });
  return { connected: !!row, account: row?.account ?? undefined };
}

export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Scope yang benar-benar diberikan user saat menghubungkan akun (kosong jika belum terhubung). */
export async function grantedScopes(connector: GoogleOAuthConnector): Promise<string[]> {
  const row = await prisma.connectorCredential.findUnique({ where: { connector } });
  if (!row) return [];
  return ((JSON.parse(decrypt(row.data)) as StoredToken).scope ?? "").split(/\s+/).filter(Boolean);
}

/** OAuth2Client siap pakai (refresh token terpasang), atau null jika belum terhubung. */
export async function authorizedClient(connector: GoogleOAuthConnector): Promise<{ client: OAuth2Client; email?: string } | null> {
  const row = await prisma.connectorCredential.findUnique({ where: { connector } });
  if (!row) return null;
  const token = JSON.parse(decrypt(row.data)) as StoredToken;
  const c = client();
  c.setCredentials({ refresh_token: token.refresh_token });
  return { client: c, email: token.email };
}

/**
 * Boleh mencabut token di Google? Pencabutan di Google berlaku untuk seluruh izin app ini di akun tersebut
 * (semua refresh token GA4/GSC/YouTube milik akun yang sama ikut mati). Jadi hanya dicabut jika tidak ada
 * connector lain yang memakai akun yang sama; akun tidak diketahui (null) dianggap bisa sama.
 */
export function shouldRevoke(account: string | null, others: { connector: string; account: string | null }[]): { revoke: boolean; sharedWith: string[] } {
  const norm = (a: string | null) => a?.trim().toLowerCase() || null;
  const me = norm(account);
  const sharedWith = others.filter((o) => me === null || norm(o.account) === null || norm(o.account) === me).map((o) => o.connector);
  return { revoke: sharedWith.length === 0, sharedWith };
}

/**
 * Putuskan: hapus token dari DB, dan cabut di Google (best effort) hanya jika akun itu tidak dipakai
 * connector Google lain. `sharedWith` = connector yang masih memakai akun yang sama (token tidak dicabut).
 */
export async function disconnect(connector: GoogleOAuthConnector): Promise<{ revoked: boolean; sharedWith: GoogleOAuthConnector[] }> {
  const row = await prisma.connectorCredential.findUnique({ where: { connector } });
  if (!row) return { revoked: false, sharedWith: [] };
  const others = await prisma.connectorCredential.findMany({
    where: { connector: { in: Object.keys(GOOGLE_SCOPES).filter((c) => c !== connector) } },
    select: { connector: true, account: true },
  });
  const { revoke, sharedWith } = shouldRevoke(row.account, others);
  let revoked = false;
  if (revoke) {
    try {
      const token = JSON.parse(decrypt(row.data)) as StoredToken;
      await client().revokeToken(token.refresh_token);
      revoked = true;
    } catch {
      /* token mungkin sudah tidak berlaku — tetap hapus dari DB */
    }
  }
  await prisma.connectorCredential.delete({ where: { connector } });
  return { revoked, sharedWith: sharedWith as GoogleOAuthConnector[] };
}
