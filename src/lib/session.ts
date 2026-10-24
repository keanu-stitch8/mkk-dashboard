// Sesi login untuk Server Component & Route Handler (proxy.ts sudah menolak permintaan tanpa sesi).
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession, type Session } from "./auth";

export async function currentUser(): Promise<Session | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}
