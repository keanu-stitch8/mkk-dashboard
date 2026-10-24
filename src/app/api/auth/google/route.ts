// GET /api/auth/google?connector=ga4|gsc|youtube → redirect ke halaman consent Google.
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, isGoogleOAuthConnector } from "@/modules/connectors/sources/google-oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const connector = req.nextUrl.searchParams.get("connector") ?? "";
  const back = new URL("/settings/connectors", req.url);
  if (!isGoogleOAuthConnector(connector)) {
    back.searchParams.set("error", "Unknown connector for Google OAuth.");
    return NextResponse.redirect(back);
  }
  try {
    // state = connector + nonce acak; nonce disimpan di cookie untuk cegah CSRF
    const nonce = randomBytes(16).toString("base64url");
    const res = NextResponse.redirect(authUrl(connector, `${connector}.${nonce}`, req.nextUrl.origin));
    res.cookies.set("google_oauth_state", nonce, { httpOnly: true, sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
    return res;
  } catch (e) {
    back.searchParams.set("error", (e as Error).message);
    return NextResponse.redirect(back);
  }
}
