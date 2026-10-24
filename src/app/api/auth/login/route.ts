// POST /api/auth/login — form login (name, password, next) → cookie sesi, lalu kembali ke halaman tujuan.
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS, authConfigured, checkPassword, cleanName, clearFailedLogins, createSessionToken, loginAllowed, recordFailedLogin, safeNext } from "@/modules/auth/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const name = cleanName(String(form.get("name") ?? ""));
  const next = safeNext(String(form.get("next") ?? ""));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const back = (error: string) => {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", error);
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  };

  if (!authConfigured()) return back("not-configured");
  if (!loginAllowed(ip)) return back("too-many");
  if (!name) return back("name");
  if (!checkPassword(String(form.get("password") ?? ""))) {
    recordFailedLogin(ip);
    return back("password");
  }
  clearFailedLogins(ip);

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(SESSION_COOKIE, createSessionToken(name), { httpOnly: true, secure: https, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
  return res;
}
