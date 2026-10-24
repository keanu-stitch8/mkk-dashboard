// Semua halaman & API butuh login (lihat lib/auth.ts), kecuali halaman login itu sendiri dan aset statis.
// Pemeriksaan cukup di sini: cookie diverifikasi tanda tangannya (tanpa database), jadi tidak bisa dipalsukan.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authRequired, readSession } from "@/lib/auth";

const PUBLIC = ["/login", "/api/auth/login"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!authRequired() || PUBLIC.includes(pathname)) return NextResponse.next();
  if (readSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
