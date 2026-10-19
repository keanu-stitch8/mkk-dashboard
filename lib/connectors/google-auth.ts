// Resolusi auth Google untuk connector REST (googleapis): service account atau OAuth akun pengguna.
import { GoogleAuth, type OAuth2Client } from "google-auth-library";
import { ConnectorError } from "./types";
import { serviceAccountKey } from "./common";
import { authorizedClient, OAUTH_ONLY, type GoogleOAuthConnector } from "./google-oauth";

export interface AuthInfo {
  mode: "service_account" | "oauth";
  account?: string;
}

export const hasServiceAccount = () => !!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

/** Service account didahulukan jika diisi; selain itu OAuth akun Google yang terhubung untuk connector ini. */
export async function resolveGoogleAuth(connector: GoogleOAuthConnector, scopes: string[], label: string): Promise<{ auth: GoogleAuth | OAuth2Client; info: AuthInfo }> {
  if (!OAUTH_ONLY.includes(connector) && hasServiceAccount()) {
    const key = serviceAccountKey();
    return { auth: new GoogleAuth({ keyFile: key.path, scopes }), info: { mode: "service_account", account: key.clientEmail } };
  }
  const oauth = await authorizedClient(connector);
  if (oauth) return { auth: oauth.client, info: { mode: "oauth", account: oauth.email } };
  throw new ConnectorError(
    connector === "youtube"
      ? "YouTube belum terhubung. Klik “Hubungkan akun Google” di kartu YouTube dan login dengan akun pemilik channel."
      : connector === "sheets"
        ? "Google Sheets belum terhubung. Klik “Hubungkan akun Google” di kartu Google Sheets dan login dengan akun yang bisa membuka spreadsheet log."
        : `Belum ada kredensial ${label}: isi GOOGLE_APPLICATION_CREDENTIALS (service account), atau klik “Hubungkan akun Google” di kartu ${label}.`,
  );
}
