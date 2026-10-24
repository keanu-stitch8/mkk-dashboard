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
      ? "YouTube isn't connected. Click “Connect Google account” on the YouTube card and sign in with the channel owner's account."
      : connector === "sheets"
        ? "Google Sheets isn't connected. Click “Connect Google account” on the Google Sheets card and sign in with an account that can open the log spreadsheets."
        : `No ${label} credentials yet: set GOOGLE_APPLICATION_CREDENTIALS (service account), or click “Connect Google account” on the ${label} card.`,
  );
}
