// GET /api/auth/youtube → alur OAuth Google untuk YouTube (scope yt-analytics.readonly + youtube.readonly,
// access_type=offline, prompt=consent). Callback memakai /api/auth/google/callback yang sama dengan GA4/GSC,
// jadi cukup satu redirect URI terdaftar di OAuth client.
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/api/auth/google?connector=youtube", req.url));
}
