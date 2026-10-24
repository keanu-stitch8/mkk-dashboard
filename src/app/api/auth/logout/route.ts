// POST /api/auth/logout — hapus cookie sesi, kembali ke halaman login.
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/modules/auth/auth";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
