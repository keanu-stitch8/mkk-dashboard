// Login sederhana tim: satu password bersama (DASHBOARD_PASSWORD) + nama, disimpan di cookie yang ditandatangani
// HMAC-SHA256 (tanpa database). Ganti password → semua sesi lama otomatis tidak berlaku. Nama dipakai untuk
// mencatat siapa yang mengonfirmasi pasangan di halaman Team.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "mkk_session";
export const SESSION_DAYS = 30;

export interface Session {
  name: string;
}

interface Payload extends Session {
  exp: number;
  /** sidik jari password saat login */
  pv: string;
}

const password = () => process.env.DASHBOARD_PASSWORD?.trim() || "";
const fingerprint = (pw: string) => createHash("sha256").update(`mkk:${pw}`).digest("hex").slice(0, 16);

/** Login aktif jika password diset. Di produksi selalu wajib — tanpa password, dashboard tertutup. */
export const authConfigured = () => !!password();
export const authRequired = () => authConfigured() || process.env.NODE_ENV === "production";

function secret(): Buffer {
  const s = process.env.SESSION_SECRET?.trim() || process.env.ENCRYPTION_KEY?.trim();
  if (!s) throw new Error("Set SESSION_SECRET (or ENCRYPTION_KEY) to sign login sessions.");
  return createHash("sha256").update(`mkk-session:${s}`).digest();
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest();

export function createSessionToken(name: string, now = Date.now()): string {
  const payload: Payload = { name, exp: now + SESSION_DAYS * 864e5, pv: fingerprint(password()) };
  const body = b64(JSON.stringify(payload));
  return `${body}.${b64(sign(body))}`;
}

/** Sesi dari isi cookie; null jika tidak ada, rusak, dipalsukan, kedaluwarsa, atau password sudah diganti. */
export function readSession(token: string | undefined, now = Date.now()): Session | null {
  if (!token || !authConfigured()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const given = Buffer.from(sig, "base64url");
    const expected = sign(body);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (typeof p.name !== "string" || !p.name || p.exp < now || p.pv !== fingerprint(password())) return null;
    return { name: p.name };
  } catch {
    return null;
  }
}

export function checkPassword(input: string): boolean {
  const pw = password();
  if (!pw) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(pw).digest();
  return timingSafeEqual(a, b);
}

/** Nama tampilan: dirapikan, maks. 40 karakter. */
export const cleanName = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 40);

/** Tujuan setelah login: hanya path internal (bukan "//domain" atau URL lain). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && !next.startsWith("/login") ? next : "/";
}

/** Batas percobaan login per IP (di memori proses): 10 kali per 15 menit. */
const attempts = new Map<string, { n: number; until: number }>();
export function loginAllowed(ip: string, now = Date.now()): boolean {
  const a = attempts.get(ip);
  return !a || a.until < now || a.n < 10;
}
export function recordFailedLogin(ip: string, now = Date.now()): void {
  const a = attempts.get(ip);
  attempts.set(ip, !a || a.until < now ? { n: 1, until: now + 15 * 60_000 } : { n: a.n + 1, until: a.until });
}
export const clearFailedLogins = (ip: string) => attempts.delete(ip);
