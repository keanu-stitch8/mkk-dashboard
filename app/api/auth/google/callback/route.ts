// GET /api/auth/google/callback?code=…&state=… → simpan refresh token terenkripsi, kembali ke halaman Connectors.
import { NextResponse, type NextRequest } from "next/server";
import { completeOAuth, isGoogleOAuthConnector } from "@/lib/connectors/google-oauth";
import { connectorLabel } from "@/lib/connectors/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const back = new URL("/settings/connectors", req.url);
  const done = (key: "connected" | "error", value: string) => {
    back.searchParams.set(key, value);
    const res = NextResponse.redirect(back);
    res.cookies.delete({ name: "google_oauth_state", path: "/api/auth/google" });
    return res;
  };

  if (params.get("error")) {
    return done("error", params.get("error") === "access_denied" ? "Akses ditolak di halaman consent Google." : `Google mengembalikan error: ${params.get("error")}`);
  }
  const [connector, nonce] = (params.get("state") ?? "").split(".");
  if (!isGoogleOAuthConnector(connector) || !nonce || nonce !== req.cookies.get("google_oauth_state")?.value) {
    return done("error", "Sesi login kedaluwarsa atau tidak valid. Klik tombol Hubungkan lagi.");
  }
  const code = params.get("code");
  if (!code) return done("error", "Kode otorisasi tidak ada di respons Google.");

  try {
    const email = await completeOAuth(connector, code, req.nextUrl.origin);
    return done("connected", `${connectorLabel(connector)} terhubung${email ? ` sebagai ${email}` : ""}.`);
  } catch (e) {
    const msg = (e as Error).message;
    return done("error", /redirect_uri_mismatch/i.test(msg) ? "Redirect URI tidak cocok. Daftarkan http://localhost:3000/api/auth/google/callback di OAuth client Google Cloud." : msg);
  }
}
